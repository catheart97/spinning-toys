import * as bjs from '@babylonjs/core'
import { GRAVITY, ITop, TopMaterial, matMul, quaternionToMatrix } from './ITop';
import { dyad } from './Tools';
import { CrossMatrix } from './TippeTop';
import { PHI } from "./PhiTop";

type Transform = {
    q: bjs.Quaternion,
    p: bjs.Vector3,
    v: bjs.Vector3,
    w: bjs.Vector3
}

export const quatMul = (a: bjs.Quaternion, b: bjs.Quaternion) => {
    return a.multiply(b);
}

export class Rattleback extends ITop {

    private B0: bjs.Matrix;
    private d: number;

    constructor(name: string, scene: bjs.Scene) {

        const massE = 0.1 * 100;
        const scale = 1 // 0.16848;

        const rx = scale * PHI;
        const ry = scale;
        const rz = scale;

        const ellipsoid = bjs.CreateSphere(
            "rattlebackEllipsoid", {
            diameterX: 2 * rx,
            diameterY: 2 * ry,
            diameterZ: 2 * rz
        }, scene)

        const box = bjs.CreateBox(
            "rattlebackBox", {
            height: ry,
            width: 2 * rx,
            depth: 2 * rz
        },
            scene
        )

        box.position = new bjs.Vector3(0, 0.5 * ry, 0);

        const ellipsoidCSG = bjs.CSG.FromMesh(ellipsoid);
        const boxCSG = bjs.CSG.FromMesh(box);

        const mesh = ellipsoidCSG.subtract(boxCSG).toMesh("rattleback", TopMaterial(scene), scene);
        // const mesh = ellipsoid;

        scene.removeMesh(ellipsoid);
        scene.removeMesh(box);

        const massP = 0.05 * 100;
        const p = new bjs.Vector3(0.5, 0, 0.5);

        const totalMass = 2 * massP + massE;
        const d = massE / totalMass * 3 * ry / 8;
        const centerOfMass = new bjs.Vector3(0, -d, 0);
        const CR = bjs.Matrix.Identity().scale(bjs.Vector3.Dot(centerOfMass, centerOfMass)).add(
            dyad(centerOfMass, centerOfMass).scale(-1)
        );

        const P = bjs.Matrix.Identity().scale(bjs.Vector3.Dot(p, p)).add(dyad(p, p).scale(-1));

        let momentOfInertia = new bjs.Matrix();
        let tx = 0.2 * massE * (ry * ry + rz * rz);
        let ty = 0.2 * massE * (rx * rx + rz * rz);
        let tz = 0.2 * massE * (rx * rx + ry * ry);
        momentOfInertia.setRowFromFloats(0, tx, 0, 0, 0);
        momentOfInertia.setRowFromFloats(1, 0, ty, 0, 0);
        momentOfInertia.setRowFromFloats(2, 0, 0, tz, 0);
        momentOfInertia.setRowFromFloats(3, 0, 0, 0, 1);

        momentOfInertia = momentOfInertia.add(P.scale(2 * massP)).add(CR.scale(-totalMass));

        super(name, scene, momentOfInertia, totalMass);

        this.B0 = new bjs.Matrix();
        this.B0.setRowFromFloats(0, 1 / (rx * rx), 0, 0, 0);
        this.B0.setRowFromFloats(1, 0, 1 / (ry * ry), 0, 0);
        this.B0.setRowFromFloats(2, 0, 0, 1 / (rz * rz), 0);
        this.B0.setRowFromFloats(3, 0, 0, 0, 1);

        console.log("I0", this.momentOfInertia)
        console.log("B0", this.B0)

        const position = new bjs.Vector3(
            0, Math.abs(d), 0
        )
        mesh.position = position;
        mesh.parent = this;
        this.d = d;
        this.simulationStepsPerFrame = 50;

        this.reset();
    }

    contactPoint(worldRotation: bjs.Matrix): bjs.Vector3 {
        const R = quaternionToMatrix(this.rotationQuaternion!);
        const B_inv = (R.multiply(this.B0.clone().multiply(R.transpose()))).invert();
        B_inv.setRowFromFloats(3, 0, 0, 0, 1);
        // extreme point in y-direction (upwards/downwards)
        let r = matMul(B_inv, bjs.Vector3.Up()).scale(
            -1 / Math.sqrt(
                bjs.Vector3.Dot(
                    bjs.Vector3.Up(),
                    matMul(B_inv, bjs.Vector3.Up())
                )
            )
        )
        const Re3 = matMul(R, bjs.Vector3.Up());
        r = r.add(Re3.scale(this.d))
        return r;
    }

    reset() {
        super.reset();
        try {
            this.position = bjs.Vector3.Zero();

            this.angularVelocity = new bjs.Vector3(0.01, 2.0, -0.02);
            this.velocity = bjs.Vector3.Cross(
                this.contactPoint(bjs.Matrix.Identity()),
                this.angularVelocity
            )
        } catch (e) {
            console.log(e);
        }
    }

    drdt(r: bjs.Vector3, B_inv: bjs.Matrix, transform: Transform) {
        const s = -bjs.Vector3.Dot(bjs.Vector3.Up(), r);
        const wxr = bjs.Vector3.Cross(transform.w, r);
        const wxu = bjs.Vector3.Cross(transform.w, bjs.Vector3.Up());
        const rp = wxr.add(
            matMul(B_inv, wxu).scale(1 / s)
        ).add(
            r.scale(bjs.Vector3.Dot(bjs.Vector3.Up(), wxr) / s)
        )
        return rp;
    }

    dfdt(transform: Transform): Transform {

        console.log("c", transform.p)
        console.log("q", transform.q)
        console.log("v", transform.v)
        console.log("w", transform.w)

        // R := world matrix
        const R = quaternionToMatrix(transform.q);
        
        // I := inertia
        const I = R.multiply(this.momentOfInertia.clone().multiply(R.transpose()));
        // I.setRowFromFloats(3, 0, 0, 0, 1);
        const B_inv = R.multiply(this.B0.clone().multiply(R.transpose())).invert();
        // B_inv.setRowFromFloats(3, 0, 0, 0, 1);

        // extreme point in y-direction (upwards/downwards)
        let r = matMul(B_inv, bjs.Vector3.Up()).scale(
            -Math.sqrt(
                bjs.Vector3.Dot(
                    bjs.Vector3.Up(),
                    matMul(B_inv, bjs.Vector3.Up())
                )
            )
        )
        let dr = this.drdt(r, B_inv, transform);

        const Re3 = matMul(R, bjs.Vector3.Up())
        r = r.add(Re3.scale(this.d))

        dr = dr.add(bjs.Vector3.Cross(transform.w, Re3).scale(this.d))

        const I_INV = (I.clone().add(dyad(r, r).scale(-this.totalMass)).add(
            bjs.Matrix.Identity().scale(this.totalMass * bjs.Vector3.Dot(r, r))
        )).invert();
        I_INV.setRowFromFloats(3, 0, 0, 0, 1);

        const rxu = bjs.Vector3.Cross(r, bjs.Vector3.Up()).scale(9.81 * this.totalMass);
        const wxIw = bjs.Vector3.Cross(
            transform.w,
            matMul(I, transform.w)
        );
        const rxwxdr = bjs.Vector3.Cross(
            r,
            bjs.Vector3.Cross(
                transform.w,
                dr
            )
        ).scale(this.totalMass);

        const u = rxu.subtract(wxIw).subtract(rxwxdr);

        const dw = matMul(I_INV, u);

        const dv = bjs.Vector3.Cross(dw, r).scale(-1).subtract(
            bjs.Vector3.Cross(transform.w, dr)
        );
        dv.y = 0;

        const dc = transform.v.clone();

        const qw = new bjs.Quaternion(transform.w.x, transform.w.y, transform.w.z, 0);
        const dq = quatMul(qw, transform.q).scale(0.5);
        // const dq = quatMul(transform.q, qw).scale(0.5);

        return {
            p: dc,
            q: dq,
            v: dv,
            w: dw
        }
    }

    step(dt: number, _world: bjs.Matrix, _inertia: bjs.Matrix): void {


        const euler = (transform: Transform, dt: number) : Transform => {
            const k1 = this.dfdt(transform);
            return k1
        }

        const heun = (transform: Transform, dt: number) : Transform => {
            const k1 = this.dfdt(transform);
            const k2 = this.dfdt({
                q: transform.q.add(k1.q.scale(dt)),
                p: transform.p.add(k1.p.scale(dt)),
                v: transform.v.add(k1.v.scale(dt)),
                w: transform.w.add(k1.w.scale(dt))
            })

            return {
                q: transform.q.add(
                    k1.q.add(k2.q).scale(dt / 2)
                ),
                p: transform.p.add(
                    k1.p.add(k2.p).scale(dt / 2)
                ),
                v: transform.v.add(
                    k1.v.add(k2.v).scale(dt / 2)
                ),
                w: transform.w.add(
                    k1.w.add(k2.w).scale(dt / 2)
                )
            }
        }

        const rk4 = (transform: Transform, dt: number) : Transform => {

            const dt2 = dt / 2;
            const dt3 = dt / 3;
            const dt6 = dt / 6;

            const k1 = this.dfdt(transform);
            let tmp = {
                q: transform.q.add(k1.q.scale(dt2)),
                p: transform.p.add(k1.p.scale(dt2)),
                v: transform.v.add(k1.v.scale(dt2)),
                w: transform.w.add(k1.w.scale(dt2))
            }
            tmp.q.normalize();
            
            const k2 = this.dfdt(tmp)
            tmp = {
                q: transform.q.add(k2.q.scale(dt2)),
                p: transform.p.add(k2.p.scale(dt2)),
                v: transform.v.add(k2.v.scale(dt2)),
                w: transform.w.add(k2.w.scale(dt2))
            }
            tmp.q.normalize();

            const k3 = this.dfdt(tmp)
            tmp = {
                q: transform.q.add(k3.q.scale(dt)),
                p: transform.p.add(k3.p.scale(dt)),
                v: transform.v.add(k3.v.scale(dt)),
                w: transform.w.add(k3.w.scale(dt))
            }
            tmp.q.normalize();

            const k4 = this.dfdt(tmp)

            return {
                q: transform.q.add(
                    k1.q.add(k4.q).scale(dt6).add(
                        k2.q.add(k3.q).scale(dt3)
                    )
                ),
                p: transform.p.add(
                    k1.p.add(k4.p).scale(dt6).add(
                        k2.p.add(k3.p).scale(dt3)
                    )
                ),
                v: transform.v.add(
                    k1.v.add(k4.v).scale(dt6).add(
                        k2.v.add(k3.v).scale(dt3)
                    )
                ),
                w: transform.w.add(
                    k1.w.add(k4.w).scale(dt6).add(
                        k2.w.add(k3.w).scale(dt3)
                    )
                )
            }
        }

        // this.position = DATA[s].position;
        // this.rotationQuaternion = DATA[s].rotation;
        // s = (s + 10) % DATA.length;

        // if (s >= 5) return;

        // if (s == 50) return;

        // this.rotate(new bjs.Vector3(1,0,0), 0.01);
        // return;

        dt = 5e-4;

        // convert from left handed to right handed coordinate system
        const rotation = new bjs.Quaternion(
            this.rotationQuaternion!.x,
            this.rotationQuaternion!.y,
            this.rotationQuaternion!.z,
            this.rotationQuaternion!.w
        );

        const position = new bjs.Vector3(
            this.position.x,
            this.position.y,
            this.position.z
        );

        const initial: Transform = {
            q: rotation.normalizeToNew(),
            p: position.clone(),
            v: this.velocity.clone(),
            w: this.angularVelocity.clone()
        }

        const res = rk4(initial, dt);

        console.log(res);

        res.q.normalize();

        this.rotationQuaternion = new bjs.Quaternion(
            res.q.x,
            res.q.y,
            res.q.z,
            res.q.w
        );
        this.position = new bjs.Vector3(
            res.p.x,
            res.p.y,
            res.p.z
        );
        this.velocity = res.v;
        this.angularVelocity = res.w;

        s++;
    }
}

let s = 0;