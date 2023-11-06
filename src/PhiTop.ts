import * as bjs from '@babylonjs/core'
import { GRAVITY, ITop, TopMaterial } from './ITop';

export const PHI = 1.6180339887;

export class PhiTop extends ITop {

    private scale = 0.16848;
    private mass = 0.25;
    private friction = 0.3;

    constructor(name: string, scene: bjs.Scene) {
        const mass = 0.25;
        const scale = 0.16848;

        const rx = scale;
        const ry = scale * PHI;
        const rz = scale;

        const mesh = bjs.CreateSphere("phitop", {
            diameterX: 2 * rx,
            diameterY: 2 * ry,
            diameterZ: 2 * rz
        }, scene)

        mesh.material = TopMaterial(scene);

        const momentOfInertia = new bjs.Matrix();
        let tx = mass / 5 * (ry * ry + rz * rz);
        let ty = mass / 5 * (rx * rx + rz * rz);
        let tz = mass / 5 * (rx * rx + ry * ry);
        momentOfInertia.setRowFromFloats(0, tx, 0, 0, 0);
        momentOfInertia.setRowFromFloats(1, 0, ty, 0, 0);
        momentOfInertia.setRowFromFloats(2, 0, 0, tz, 0);
        momentOfInertia.setRowFromFloats(3, 0, 0, 0, 1);

        super(name, scene, momentOfInertia, mass);

        mesh.parent = this;
        this.scale = scale;
        this.simulationStepsPerFrame = 60;
    }

    contactPoint(worldRotation: bjs.Matrix): bjs.Vector3 {
        let u = worldRotation.transpose().getRow(1)!.toVector3()!;
        let p = new bjs.Vector3(-u.x, -u.y * PHI * PHI, -u.z);
        p = p.scale(Math.sqrt(1 / ((p.x * p.x) + (p.y * p.y / (PHI * PHI)) + (p.z * p.z)))).scale(this.scale)
        return bjs.Vector3.TransformCoordinates(p, worldRotation);
    }

    reset() {
        super.reset();
        this.rotate(
            bjs.Vector3.Forward(), Math.PI / 2 + 0.1
        )
        this.position = bjs.Vector3.Zero();
        this.angularVelocity = new bjs.Vector3(0.1, 15 * Math.PI, 0)
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
        const acceleration = Fg.add(Fn).add(Fr).scale(1 / this.mass);
        const angularAcceleration = bjs.Vector3.TransformCoordinates(
            torque.subtract(
                bjs.Vector3.Cross(
                    this.angularVelocity,
                    bjs.Vector3.TransformCoordinates(
                        this.angularVelocity,
                        inertia
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