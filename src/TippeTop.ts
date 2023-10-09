import { GRAVITY, ITop, TopMaterial, steiner } from "./ITop";
import * as bjs from '@babylonjs/core'
import { dyad } from "./Tools";

export const CrossMatrix = (v: bjs.Vector3) => {
    const r = new bjs.Matrix();
    r.setRowFromFloats(0, 0, -v.z, v.y, 0);
    r.setRowFromFloats(1, v.z, 0, -v.x, 0);
    r.setRowFromFloats(2, -v.y, v.x, 0, 0);
    return r;
}


export class TippeTop extends ITop {
    r1: number
    r2: number
    c: number
    friction = 0.4;

    constructor(name: string, scene: bjs.Scene) {
        const r1 = 0.25;
        const r2 = 0.1;
        const h = r1 - r2;
        const c = - 3 / 8 * h;

        const mass = 0.1;
        const massSphere = 0.01 * mass;
        const massCap = 0.99 * mass;

        const smallSphere = bjs.CreateSphere(
            "tippeTopSmallSphere", {
            diameter: 2 * r2
        }, scene);
        smallSphere.position.y = r1;

        const sphere = bjs.CreateSphere(
            "tippeTopSphere", {
            diameter: 2 * r1
        }, scene);

        const box = bjs.CreateBox(
            "tippeTopBox", {
            height: 2 * r2,
            width: 2,
            depth: 2
        }, scene);
        box.position.y = r1;

        const sphereCSG = bjs.CSG.FromMesh(sphere);
        const smallSphereCSG = bjs.CSG.FromMesh(smallSphere);
        const boxCSG = bjs.CSG.FromMesh(box);
        // const cutSphere = sphereCSG;
        const cutSphere = sphereCSG.subtract(boxCSG)

        sphere.dispose();
        box.dispose();
        smallSphere.dispose();

        const mesh = cutSphere.union(smallSphereCSG).toMesh("tippeTop", TopMaterial(scene), scene);
        mesh.position.y = c;

        let smallMomentOfInertia = bjs.Matrix.Identity();
        const stx = massSphere / 5 * 2 * r2 ** 2;
        const sty = massSphere / 5 * 2 * r2 ** 2;
        const stz = massSphere / 5 * 2 * r2 ** 2;
        smallMomentOfInertia.setRowFromFloats(0, stx, 0, 0, 0);
        smallMomentOfInertia.setRowFromFloats(1, 0, sty, 0, 0);
        smallMomentOfInertia.setRowFromFloats(2, 0, 0, stz, 0);
        smallMomentOfInertia.setRowFromFloats(3, 0, 0, 0, 1);

        smallMomentOfInertia = smallMomentOfInertia.add(
            steiner(new bjs.Vector3(0, r1 - c, 0), massSphere)
        );

        let I0 = new bjs.Matrix();
        const tx = massCap / 10 * (4 * r1 ** 2 - h * r1 + h ** 2);
        const ty = massCap / 5 * (2 * r1 ** 2 + h * r1 + h ** 2);
        const tz = tx;
        I0.setRowFromFloats(0, tx, 0, 0, 0);
        I0.setRowFromFloats(1, 0, ty, 0, 0);
        I0.setRowFromFloats(2, 0, 0, tz, 0);
        I0.setRowFromFloats(3, 0, 0, 0, 1);

        const uvec = new bjs.Vector3(0, c, 0);
        I0 = I0.add(steiner(uvec, massCap)).add(smallMomentOfInertia);
        I0.setRowFromFloats(3, 0, 0, 0, 1);

        super(name, scene, I0, mass);
        mesh.parent = this;
        this.simulationStepsPerFrame = 10;
        this.r1 = r1;
        this.r2 = r2;
        this.c = c;
    }

    reset(): void {
        super.reset();
        this.rotationQuaternion = bjs.Quaternion.RotationAxis(
            bjs.Vector3.Forward(), Math.PI - 1.1
        ).multiplyInPlace(bjs.Quaternion.RotationAxis(
            bjs.Vector3.Right(), 0.1
        ));
        this.position = bjs.Vector3.Zero();
        this.angularVelocity = new bjs.Vector3(0, 15 * Math.PI, 0)
    }

    contactPoint(worldRotation: bjs.Matrix): bjs.Vector3 {
        let u = worldRotation.transpose().getRow(1)!.toVector3()!;
        const threshold = Math.acos((this.r1 - this.r2) / this.r1);
        const value = Math.acos(bjs.Vector3.Dot(u, bjs.Vector3.Down()));
        if (value < threshold) {
            return bjs.Vector3.Up().scale(-this.r2).add(
                u.scale(this.r1 + this.c)
            );
        } else if (value == threshold) {
            return bjs.Vector3.Lerp(
                bjs.Vector3.Up().scale(-this.r1).add(
                    u.scale(this.c)
                ),
                bjs.Vector3.Up().scale(-this.r2).add(
                    u.scale(this.r1 + this.c)
                ),
                0.5
            );
        } else {
            return bjs.Vector3.Up().scale(-this.r1).add(
                u.scale(this.c)
            );
        }
    }

    step(dt: number, world: bjs.Matrix, inertia: bjs.Matrix): void {

        // compute contact point
        const pWorld = this.contactPoint(world);

        // gravity force
        const Fg = GRAVITY.clone().scale(this.totalMass);

        // friction force
        const Fr = this.velocity.add(
            bjs.Vector3.Cross(pWorld, this.angularVelocity)
        ).scale(-this.friction);

        // normal force
        let Fn = new bjs.Vector3(
            0,
            (
                (
                    (
                        (-pWorld.y - this.position.y) / dt
                    ) - this.velocity.y
                ) * this.totalMass
            ) / dt - Fg.y - Fr.y,
            0
        );

        // compute torques
        const torque = bjs.Vector3.Cross(Fn.scale(-1).add(Fr), pWorld);

        if (Fr.length() < 0.05) {
            torque.addInPlace(
                this.angularVelocity.scale(-dt)
            )
            torque.addInPlace(new bjs.Vector3(
                dt * this.angularVelocity.length() * 0.01, 0, 0
            ));
        }

        // compute accelerations
        const acceleration = Fg.add(Fn).add(Fr).scale(1 / this.totalMass);
        const angularAcceleration = bjs.Vector3.TransformCoordinates(
            torque.subtract(
                bjs.Vector3.Cross(
                    this.angularVelocity,
                    bjs.Vector3.TransformCoordinates(
                        this.angularVelocity,
                        inertia.clone()
                    )
                )
            ),
            inertia.clone().invert()
        )

        // integrate using euler
        this.angularVelocity.addInPlace(angularAcceleration.scale(dt));
        this.velocity.addInPlace(acceleration.scale(dt));

        this.position.addInPlace(this.velocity.scale(dt));
        this.rotationQuaternion = bjs.Quaternion.RotationAxis(
            this.angularVelocity.normalizeToNew(),
            this.angularVelocity.length() * dt
        ).multiplyInPlace(this.rotationQuaternion!);
    }
}