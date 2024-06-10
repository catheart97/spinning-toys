import * as bjs from '@babylonjs/core';
import '@babylonjs/loaders';
import { IUpdateable, Transform, dyad, matMul, rk4, vecMul } from '../Utility';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const GRAVITY = 9.81;

export class Rattleback implements IUpdateable {
    slideFriction: number = 2;
    rollFriction = 0.01;
    mass: number = .5;
    massPoints = 0.05 * 100;
    massEllipsoid = 0.1 * 100;

    centerOfMassOffset: number = 0;
    centerOfMass: bjs.Vector3 = bjs.Vector3.Zero();

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

    public simulationStepsPerFrame: number = 50;

    protected B0: bjs.Matrix;

    constructor(private root: bjs.TransformNode) {
        this.mass = 2 * this.massPoints + this.massEllipsoid;

        this.centerOfMassOffset = this.massEllipsoid / this.mass * 3 / 8;
        this.centerOfMass = new bjs.Vector3(0, -this.centerOfMassOffset, 0);

        const mesh = this.root.getChildMeshes()[0] as bjs.Mesh;
        // this.mesh = mesh;
        const meshWrapper = new bjs.TransformNode("meshWrapper", mesh.getScene());
        meshWrapper.position = root.position;
        meshWrapper.parent = root;
        mesh.parent = meshWrapper;
        mesh.position = this.centerOfMass.scale(-1);
        this.mesh = meshWrapper;

        const p = new bjs.Vector3(0.5, 0, 0.5);
        const P = bjs.Matrix.Identity().scale(bjs.Vector3.Dot(p, p)).add(dyad(p, p).scale(-1));
        const CR = bjs.Matrix.Identity().scale(bjs.Vector3.Dot(this.centerOfMass, this.centerOfMass)).add(
            dyad(this.centerOfMass, this.centerOfMass).scale(-1)
        );

        this.mesh.rotationQuaternion = bjs.Quaternion.Identity();
        const ty = this.mass / 5.0 * (PHI * PHI + 1.0);
        const tx = this.mass / 5.0 * 2.0;
        const tz = ty;
        this.momentOfInertia = new bjs.Matrix();
        this.momentOfInertia.setRowFromFloats(0, tx, 0, 0, 0);
        this.momentOfInertia.setRowFromFloats(1, 0, ty, 0, 0);
        this.momentOfInertia.setRowFromFloats(2, 0, 0, tz, 0);
        this.momentOfInertia.setRowFromFloats(3, 0, 0, 0, 1);
        this.momentOfInertia = this.momentOfInertia.add(P.scale(2 * this.massPoints)).add(CR.scale(-this.mass));

        this.B0 = new bjs.Matrix();
        this.B0.setRowFromFloats(0, 1 / (PHI * PHI), 0, 0, 0);
        this.B0.setRowFromFloats(1, 0, 1, 0, 0);
        this.B0.setRowFromFloats(2, 0, 0, 1, 0);
        this.B0.setRowFromFloats(3, 0, 0, 0, 1);

        this.reset();
    }

    reset() {
        this.mesh.rotationQuaternion = bjs.Quaternion.RotationAxis(
            bjs.Vector3.Forward(), 0.01
        )
        // this.mesh.rotationQuaternion = bjs.Quaternion.Identity();
        this.mesh.position = bjs.Vector3.Zero();
        this.velocity = bjs.Vector3.Zero();
        this.angularVelocity = new bjs.Vector3(0.01, -2.0, -0.02);

        const world = new bjs.Matrix();
        this.mesh.rotationQuaternion!.toRotationMatrix(world);
        const pWorld = this.r0(world);
        this.mesh.position.y = -pWorld.y;
    }

    public applyAngularAcceleration(angularAcceleration: bjs.Vector3) {
        this.angularVelocity.addInPlace(angularAcceleration);
    }

    r0(R: bjs.Matrix, B_inv?: bjs.Matrix): bjs.Vector3 {
        const Re3 = vecMul(R, bjs.Vector3.Up())
        return this.r(R, B_inv).add(Re3.scale(this.centerOfMassOffset));
    }

    r(R: bjs.Matrix, B_inv?: bjs.Matrix): bjs.Vector3 {
        B_inv = B_inv ?? matMul(matMul(R.transpose(), this.B0.clone()), R).invert();
        let r = vecMul(B_inv, bjs.Vector3.Up()).scale(
            -1 / Math.sqrt(
                bjs.Vector3.Dot(
                    bjs.Vector3.Up(),
                    vecMul(B_inv, bjs.Vector3.Up())
                )
            )
        )
        return r;
    }

    dr(r: bjs.Vector3, B_inv: bjs.Matrix, transform: Transform) {
        // reoccuring terms
        // 1 / -u^T * r
        const s = 1 / -bjs.Vector3.Dot(bjs.Vector3.Up(), r);
        // (w x r)
        const wxr = bjs.Vector3.Cross(transform.angularVelocity, r);
        // (w x u)
        const wxu = bjs.Vector3.Cross(transform.angularVelocity, bjs.Vector3.Up());
        // (w x r) - B^-1 (w x u) / (u^T * r) - r * u^T(w x r)
        const rp = wxr.add(
            vecMul(B_inv, wxu).scale(s)
        ).add(
            r.scale(bjs.Vector3.Dot(bjs.Vector3.Up(), wxr) * s)
        )
        return rp;
    }

    df(t: Transform) {
        const R = new bjs.Matrix();
        t.rotation.toRotationMatrix(R);

        // I and B^-1 in world space
        const I = matMul(matMul(R.transpose(), this.momentOfInertia.clone()), R);
        const B_inv = matMul(matMul(R.transpose(), this.B0.clone()), R).invert();

        // compute contact point and its derivative
        let r = this.r(R, B_inv);
        let dr = this.dr(r, B_inv, t);
        
        // adjust for the offset to the center of mass
        const Re3 = vecMul(R, bjs.Vector3.Up())
        r = r.add(Re3.scale(this.centerOfMassOffset))
        dr = dr.add(bjs.Vector3.Cross(t.angularVelocity, Re3).scale(this.centerOfMassOffset))

        // J = (I - m r r^T + m r^T r)^-1
        const J = (I.clone().subtract(dyad(r, r).scale(this.mass)).add(
            bjs.Matrix.Identity().scale(this.mass * bjs.Vector3.Dot(r, r))
        )).invert();
        J.setRowFromFloats(3, 0, 0, 0, 1);

        // m g r x u
        const mgrxu = bjs.Vector3.Cross(r, bjs.Vector3.Up()).scale(GRAVITY * this.mass);

        // w x (I w)
        const wxIw = bjs.Vector3.Cross(t.angularVelocity, vecMul(I, t.angularVelocity));

        // m r x (w x dr)
        const rxwxdr = bjs.Vector3.Cross(r, bjs.Vector3.Cross(t.angularVelocity, dr)).scale(this.mass);

        // J (m g r x u - w x (I w) - m r x (w x dr))
        const dw = vecMul(J, mgrxu.subtract(wxIw).subtract(rxwxdr));
        // r x dw + dr x w
        const dv = bjs.Vector3.Cross(r, dw).add(bjs.Vector3.Cross(dr, t.angularVelocity));
        dv.y = 0;
        
        const dc = t.velocity.clone();
        
        // transform w to rotation quaternion
        const qw = new bjs.Quaternion(t.angularVelocity.x, t.angularVelocity.y, t.angularVelocity.z, 0);
        const dq = qw.multiply(t.rotation).scale(0.5);

        return {
            position: dc,
            rotation: dq,
            velocity: dv,
            angularVelocity: dw
        }
    }

    update(dt_: number): void {
        if (!this.simulate) {
            return;
        }

        // if (isNaN(this.angularVelocity.length())) {
        //     this.reset();
        //     return;
        // }

        const dt = dt_ / this.simulationStepsPerFrame;

        for (let i = 0; i < this.simulationStepsPerFrame; ++i) {
            const initial: Transform = {
                rotation: this.mesh.rotationQuaternion!.normalizeToNew(),
                position: this.mesh.position.clone(),
                velocity: this.velocity.clone(),
                angularVelocity: this.angularVelocity.clone()
            }

            const res = rk4((t) => this.df(t), initial, dt);

            this.mesh.rotationQuaternion = res.rotation;
            this.mesh.position = res.position;
            this.velocity = res.velocity;
            this.angularVelocity = res.angularVelocity;

            // const R = new bjs.Matrix();
            // this.mesh.rotationQuaternion!.toRotationMatrix(R);
            // this.mesh.position.y = -this.r(R).y;
        }
    }
}