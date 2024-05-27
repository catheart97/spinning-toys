import * as bjs from '@babylonjs/core';
import '@babylonjs/loaders'
import { CrossMatrix, DiagMatrix, IUpdateable, Transform, dyad, euler, vecMul, rk4, matMul } from './Utility';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const GRAVITY = 9.81

export class PhiTop implements IUpdateable {
    private simulate: boolean = false;
    protected friction: number = 0.3;
    protected mass: number = 1.0;
    public mesh: bjs.TransformNode;
    protected momentOfInertia: bjs.Matrix = bjs.Matrix.Identity();

    protected angularVelocity: bjs.Vector3 = bjs.Vector3.Zero();
    protected velocity: bjs.Vector3 = bjs.Vector3.Zero();

    public simulationStepsPerFrame: number = 100;

    protected B0: bjs.Matrix;

    constructor(private root: bjs.TransformNode) {
        this.mesh = this.root.getChildMeshes()[0] as bjs.Mesh;

        this.mesh.rotationQuaternion = bjs.Quaternion.Identity();
        const tx = this.mass / 5.0 * (PHI * PHI + 1.0);
        const ty = this.mass / 5.0 * 2.0;
        const tz = tx;
        this.momentOfInertia = new bjs.Matrix();
        this.momentOfInertia.setRowFromFloats(0, tx, 0, 0, 0);
        this.momentOfInertia.setRowFromFloats(1, 0, ty, 0, 0);
        this.momentOfInertia.setRowFromFloats(2, 0, 0, tz, 0);
        this.momentOfInertia.setRowFromFloats(3, 0, 0, 0, 1);

        this.B0 = new bjs.Matrix();
        this.B0.setRowFromFloats(0, 1, 0, 0, 0);
        this.B0.setRowFromFloats(1, 0, 1 / (PHI * PHI), 0, 0);
        this.B0.setRowFromFloats(2, 0, 0, 1, 0);
        this.B0.setRowFromFloats(3, 0, 0, 0, 1);

        // show axis on mesh
        const axes = new bjs.AxesViewer(this.mesh.getScene());
        axes.xAxis.parent = this.mesh;
        axes.yAxis.parent = this.mesh;
        axes.zAxis.parent = this.mesh;

        root.getScene().getEngine().getRenderingCanvas()!.addEventListener('keydown', (e) => {
            if (e.key == ' ') {
                this.simulate = !this.simulate;
                console.log(this.simulate, this.mesh.position, this.mesh.rotationQuaternion);
            } else if (e.key == 's') {
                this.applyAngularAcceleration(
                    new bjs.Vector3(0, 10 * Math.PI, 0)
                )
            }
        });

        this.reset();
    }

    reset() {
        this.mesh.rotationQuaternion = bjs.Quaternion.RotationAxis(
            bjs.Vector3.Forward(), Math.PI / 2 + 0.1
        )
        // this.mesh.rotationQuaternion = bjs.Quaternion.Identity();
        this.mesh.position = bjs.Vector3.Zero();
        this.velocity = bjs.Vector3.Zero();
        this.angularVelocity = bjs.Vector3.Zero();

        const world = new bjs.Matrix();
        this.mesh.rotationQuaternion!.toRotationMatrix(world);
        const pWorld = this.r(world);
        this.mesh.position.y = -pWorld.y;
    }

    public applyAngularAcceleration(angularAcceleration: bjs.Vector3) {
        this.angularVelocity.addInPlace(angularAcceleration);
    }

    r(R: bjs.Matrix, B_inv? : bjs.Matrix): bjs.Vector3 {
        B_inv = B_inv ?? matMul(matMul(R, this.B0.clone()), R.transpose()).invert();
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
        
        
        const B_inv = matMul(matMul(R, this.B0.clone()), R.transpose()).invert();
        const r = this.r(R, B_inv);
        const dr = this.dr(r, B_inv, t);
        const I = matMul(matMul(R, this.momentOfInertia.clone()), R.transpose());
        
        const rxu = bjs.Vector3.Cross(r, bjs.Vector3.Up());

        // reoccuring terms
        const wxr = bjs.Vector3.Cross(t.angularVelocity, r);
        const wxdr = bjs.Vector3.Cross(t.angularVelocity, dr);
        const uTwxdr = bjs.Vector3.Dot(bjs.Vector3.Up(), wxdr);
        const vpwxrµ = t.velocity.add(wxr).scale(this.friction);
        
        // (I + m * [rxu] * [rxu]^T)^-1
        const t1 = I.add(dyad(rxu, rxu).scale(this.mass)).invert();
        // m * g - m * u^T(w x dr) * rxu
        const t3 = rxu.scale(GRAVITY * this.mass - this.mass * uTwxdr)
        // w x (I * w)
        const t4 = bjs.Vector3.Cross(t.angularVelocity, vecMul(I, t.angularVelocity));
        // (r x (v + w x r)) * µ
        const t5 = bjs.Vector3.Cross(r, vpwxrµ);
        // (m * g - m * u^T(w x dr) * rxu - w x (I * w) - (r x (v + w x r)) * µ)
        const t6 = t3.subtract(t4).subtract(t5);
        // (I + m * [rxu] * [rxu]^T)^-1 * (m * g - m * u^T(w x dr) * rxu - w x (I * w) - (r x (v + w x r)) * µ)
        const dw = vecMul(t1, t6);
        
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

        this.angularVelocity.scaleInPlace(0.999);
        this.velocity.scaleInPlace(0.999);
    }
}