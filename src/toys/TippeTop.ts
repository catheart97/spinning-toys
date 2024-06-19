import * as bjs from '@babylonjs/core';
import '@babylonjs/loaders';
import { IUpdateable, Transform, dyad, matMul, rk4, vecMul } from '../Utility';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const GRAVITY = 9.81;

export class TippeTop implements IUpdateable {

    readonly radiusSmall : number = 4;
    readonly radiusLarge : number = 17;

    readonly centerOfMassOffset : number = -2.65839609;

    slideFriction: number = .5;
    rollFriction = 0.3;
    mass: number = 1;
    s: 0 | 1 = 0;

    momentOfInertia: bjs.Matrix = bjs.Matrix.Identity();
    
    public simulate: boolean = false;
    public mesh: bjs.TransformNode;
    public angularVelocity: bjs.Vector3 = bjs.Vector3.Zero();
    public velocity: bjs.Vector3 = bjs.Vector3.Zero();

    public get position(): bjs.Vector3 {
        return this.mesh.position;
    }

    public get rotation(): bjs.Quaternion {
        return this.mesh.rotationQuaternion!;
    }

    public simulationStepsPerFrame: number = 10;

    constructor(private root: bjs.TransformNode) {

        const mesh = new bjs.TransformNode('TippeTop', root.getScene());
        this.root.getChildMeshes().forEach(m => {
            m.position.y = -this.centerOfMassOffset;
            m.parent = mesh;
        });
        this.root.scaling = bjs.Vector3.One().scale(.05);
        mesh.parent = root;
        this.mesh = mesh;

        this.mesh.rotationQuaternion = bjs.Quaternion.Identity();
        this.momentOfInertia = new bjs.Matrix();
        this.momentOfInertia.setRowFromFloats(0, this.mass * 12.062612 * 12.062612, 0, 0, 0);
        this.momentOfInertia.setRowFromFloats(1, 0, this.mass * 11.265862 * 11.265862, 0, 0);
        this.momentOfInertia.setRowFromFloats(2, 0, 0, this.mass * 12.062862 * 12.062612, 0);
        this.momentOfInertia.setRowFromFloats(3, 0, 0, 0, 1);

        this.reset();
    }

    reset() {
        this.mesh.rotationQuaternion = bjs.Quaternion.RotationAxis(
            bjs.Vector3.Forward(), 0
        )
        // this.mesh.rotationQuaternion = bjs.Quaternion.Identity();
        const world = new bjs.Matrix();
        this.mesh.position = bjs.Vector3.Zero();
        this.mesh.rotationQuaternion!.toRotationMatrix(world);
        const pWorld = this.r(world);
        this.mesh.position.y = -pWorld.y;
        
        this.s = 0;

        this.angularVelocity = new bjs.Vector3(0.02, 70, -0.1);
        this.velocity = bjs.Vector3.Cross(this.angularVelocity, this.r(world)).scale(-1);
    }

    public applyAngularAcceleration(angularAcceleration: bjs.Vector3) {
        this.angularVelocity.addInPlace(angularAcceleration);
    }

    rLargeSphere(R : bjs.Matrix) {
        return bjs.Vector3.Up().scale(-this.radiusLarge).add(
            R.getRow(1).toVector3().scale(-this.centerOfMassOffset)
        )
    }

    rSmallSphere(R : bjs.Matrix) {
        return bjs.Vector3.Up().scale(-this.radiusSmall).add(
            R.getRow(1).toVector3().scale(this.radiusLarge + this.radiusSmall - this.centerOfMassOffset)
        );
    }

    r(R: bjs.Matrix): bjs.Vector3 {
        const r1 = this.rLargeSphere(R);
        const r2 = this.rSmallSphere(R);
        // return r2;
        return r1.y < r2.y ? r1 : r2;
    }

    rdr(R: bjs.Matrix, t: Transform) : [bjs.Vector3, bjs.Vector3, 0 | 1] {
        const r1 = this.rLargeSphere(R);
        const r2 = this.rSmallSphere(R);
        const dr = bjs.Vector3.Cross(t.angularVelocity, R.getRow(1).toVector3())
        if (r1.y < r2.y) {
            dr.scaleInPlace(-this.centerOfMassOffset);
            return [r1, dr, 0];
        } else {
            dr.scaleInPlace(this.radiusLarge + this.radiusSmall - this.centerOfMassOffset);
            return [r2, dr, 1];
        }
    }

    df(t: Transform) {
        const R = new bjs.Matrix();
        t.rotation.toRotationMatrix(R);

        const I = matMul(matMul(R, this.momentOfInertia.clone()), R.transpose());
        
        const [r, dr, s] = this.rdr(R, t);
        const rxu = bjs.Vector3.Cross(r, bjs.Vector3.Up());

        // reoccuring terms
        const wxr = bjs.Vector3.Cross(t.angularVelocity, r);
        const wxdr = bjs.Vector3.Cross(t.angularVelocity, dr);
        const uTwxdr = bjs.Vector3.Dot(bjs.Vector3.Up(), wxdr);
        const vpwxrµ = t.velocity.add(wxr).scale(this.slideFriction);

        // -w x (I * w) - µ_slide * (r x (v + w x r))
        const S = bjs.Vector3.Cross(
            t.angularVelocity, vecMul(I, t.angularVelocity)
        ).scale(-1).subtract(
            bjs.Vector3.Cross(r, vpwxrµ)
        );

        // r x u - µ_roll * |r| * w / |w|
        const W = rxu.subtract(t.angularVelocity.normalizeToNew().scale(this.rollFriction * r.length()));

        const J = I.add(dyad(W, rxu.scale(this.mass))).invert();

        const dw = vecMul(J, S.add(W.scale(this.mass * (GRAVITY + uTwxdr))));

        // m * (g - u^T(dw x r) - u^T(w x dr)
        const dwxr = bjs.Vector3.Cross(dw, r);
        const uTdwxr = bjs.Vector3.Dot(bjs.Vector3.Up(), dwxr);
        const lambda = this.mass * (GRAVITY - uTdwxr - uTwxdr);

        // 1/m * (-m * g * u + lambda * u - µ * (v + w x r))
        const dv = bjs.Vector3.Up().scale(-GRAVITY * this.mass + lambda).subtract(vpwxrµ).scale(1 / this.mass);

        const qw = new bjs.Quaternion(t.angularVelocity.x, t.angularVelocity.y, t.angularVelocity.z, 0);
        const dq = qw.multiply(t.rotation).scale(0.5);

        return {
            position: t.velocity,
            rotation: dq,
            velocity: dv,
            angularVelocity: dw
        }
    }

    update(dt_: number): void {

        if (!this.simulate) {
            return;
        }

        const dt = dt_ / this.simulationStepsPerFrame;

        for (let i = 0; i < this.simulationStepsPerFrame; ++i) {

            const R = new bjs.Matrix();
            this.mesh.rotationQuaternion.toRotationMatrix(R);
            const r1 = this.rLargeSphere(R);
            const r2 = this.rSmallSphere(R);

            const r = r1.y < r2.y ? r1 : r2;
            const s = r1.y < r2.y ? 0 : 1;
            
            if (this.s !== s) {
                const I = matMul(matMul(R, this.momentOfInertia.clone()), R.transpose());
                const u = this.velocity.add(
                    bjs.Vector3.Cross(this.angularVelocity, r)
                )
                const rxu = bjs.Vector3.Cross(r, bjs.Vector3.Up());
                const J = I.clone().invert();
                const p = u.y/(1/this.mass + bjs.Vector3.Dot(rxu, vecMul(J, rxu)));
                this.velocity.subtractInPlace(bjs.Vector3.Up().scale(p/this.mass));
                this.angularVelocity.subtractInPlace(vecMul(J, rxu).scale(p));
                this.s = s;
            }

            const initial: Transform = {
                rotation: this.mesh.rotationQuaternion!.normalizeToNew(),
                position: this.mesh.position.clone(),
                velocity: this.velocity.clone(),
                angularVelocity: this.angularVelocity.clone()
            }

            const res = rk4((t) => this.df(t), initial, dt);

            this.mesh.rotationQuaternion = res.rotation.normalize();
            this.mesh.position = res.position;
            this.velocity = res.velocity;
            this.angularVelocity = res.angularVelocity;
        }
    }
}