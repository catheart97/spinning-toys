import * as bjs from '@babylonjs/core';
import '@babylonjs/loaders'
import { DiagMatrix, IUpdateable, Transform } from './Utility';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const GRAVITY = new bjs.Vector3(0, -9.81, 0);

export class PhiTop implements IUpdateable {
    private simulate: boolean = false;
    protected friction: number = 0.6;
    protected mass: number = 0.25
    public mesh: bjs.Mesh;
    protected momentOfInertia: bjs.Matrix = bjs.Matrix.Identity();

    protected angularVelocity: bjs.Vector3 = bjs.Vector3.Zero();
    protected velocity: bjs.Vector3 = bjs.Vector3.Zero();

    protected addCustomTorque: boolean = true;

    public simulationStepsPerFrame: number = 100;

    constructor(private root: bjs.TransformNode) {
        this.mesh = this.root.getChildMeshes()[0] as bjs.Mesh;
        this.mesh.rotationQuaternion = bjs.Quaternion.Identity();
        this.mass = 0.25;
        const tx = this.mass / 5.0 * (PHI * PHI + 1.0);
        const ty = this.mass / 5.0 * 2.0;
        const tz = this.mass / 5.0 * (1.0 + PHI * PHI);
        this.momentOfInertia = new bjs.Matrix();
        this.momentOfInertia.setRowFromFloats(0, tx, 0, 0, 0);
        this.momentOfInertia.setRowFromFloats(1, 0, ty, 0, 0);
        this.momentOfInertia.setRowFromFloats(2, 0, 0, tz, 0);
        this.momentOfInertia.setRowFromFloats(3, 0, 0, 0, 1);

        this.reset();
    }

    reset() {
        this.mesh.rotationQuaternion = bjs.Quaternion.RotationAxis(
            bjs.Vector3.Forward(), Math.PI / 2 + 0.1
        )
        this.mesh.position = bjs.Vector3.Zero();
        this.velocity = bjs.Vector3.Zero();
        this.angularVelocity = bjs.Vector3.Zero();

        const world = new bjs.Matrix();
        this.mesh.rotationQuaternion!.toRotationMatrix(world);
        const pWorld = this.contactPoint(world);
        this.mesh.position.y = -pWorld.y;
    }

    public applyAngularAcceleration(angularAcceleration: bjs.Vector3) {
        this.angularVelocity.addInPlace(angularAcceleration);
    }

    contactPoint(worldRotation: bjs.Matrix): bjs.Vector3 {
        let u = worldRotation.transpose().getRow(1)!.toVector3()!;
        let p = new bjs.Vector3(-u.x, -u.y * PHI * PHI, -u.z);
        p = p.scale(Math.sqrt(1 / ((p.x * p.x) + (p.y * p.y / (PHI * PHI)) + (p.z * p.z))))
        return bjs.Vector3.TransformCoordinates(p, worldRotation);
    }

    customTorque(
        dt: number,
        Fr: bjs.Vector3,
        _Fg: bjs.Vector3,
        _Fn: bjs.Vector3,
        pWorld: bjs.Vector3,
        _inertia: bjs.Matrix
    ): bjs.Vector3 {
        const torque = new bjs.Vector3(0, 0, 0);
        // applies damping only when the object is not moving

        if (Math.abs(pWorld.dot(bjs.Vector3.Up())) > 0.9)

        if (Fr.length() < 0.05 && this.addCustomTorque) {
            torque.addInPlace(new bjs.Vector3(
                dt * this.angularVelocity.length() * 10, 0, 0
            ));
        }
        return torque;
    }

    update(dt_: number): void {
        if (!this.simulate) { this.simulate = true; return; }

        if (isNaN(this.angularVelocity.length())) {
            this.reset();
            return;
        }

        const dt = dt_ / this.simulationStepsPerFrame;
        for (let i = 0; i < this.simulationStepsPerFrame; ++i) {

            const world = new bjs.Matrix();
            this.mesh.rotationQuaternion!.toRotationMatrix(world);

            // compute contact point
            const pWorld = this.contactPoint(world);

            // gravity force
            const Fg = GRAVITY.clone().scale(this.mass);

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
                            (-pWorld.y - this.mesh.position.y) / dt
                        ) - this.velocity.y
                    ) * this.mass
                ) / dt - Fg.y - Fr.y,
                0
            );

            // compute torques
            const torque = bjs.Vector3.Cross(Fn.scale(-1).add(Fr), pWorld);
            const inertia = world.transpose().multiply(this.momentOfInertia.clone()).multiply(world);

            if (this.addCustomTorque) torque.addInPlace(this.customTorque(dt, Fr, Fg, Fn, pWorld, inertia));

            // compute accelerations
            const acceleration = Fg.add(Fn).add(Fr).scale(1 / this.mass);
            const coreAcc = this.mesh.position.clone().scale(-1);
            coreAcc.y = 0;
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

            this.mesh.position.addInPlace(this.velocity.scale(dt));
            this.mesh.position.addInPlace(coreAcc.scale(dt));
            this.mesh.rotationQuaternion = bjs.Quaternion.RotationAxis(
                this.angularVelocity.normalizeToNew(),
                this.angularVelocity.length() * dt
            ).multiplyInPlace(this.mesh.rotationQuaternion!);

        }


        this.angularVelocity.scaleInPlace(0.999);
        console.log(this.angularVelocity.length());
    }
}
