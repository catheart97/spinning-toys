import * as bjs from '@babylonjs/core'
import { GRAVITY, ITop, TopMaterial } from './ITop';
import { dyad } from './Tools';
import { CrossMatrix } from './TippeTop';
import { PHI } from "./PhiTop";

type Transform = {
    q: bjs.Quaternion,
    p: bjs.Vector3,
    v: bjs.Vector3,
    w: bjs.Vector3
}

export const quaternionToMatrix = (q: bjs.Quaternion) => {
    const tx = 2 * q.x;
    const ty = 2 * q.y;
    const tz = 2 * q.z;
    const twx = tx * q.w;
    const twy = ty * q.w;
    const twz = tz * q.w;
    const txx = tx * q.x;
    const txy = ty * q.x;
    const txz = tz * q.x;
    const tyy = ty * q.y;
    const tyz = tz * q.y;
    const tzz = tz * q.z;
    const m = new bjs.Matrix();
    m.setRowFromFloats(0, 1 - (tyy + tzz), txy - twz, txz + twy, 0);
    m.setRowFromFloats(1, txy + twz, 1 - (txx + tzz), tyz - twx, 0);
    m.setRowFromFloats(2, txz - twy, tyz + twx, 1 - (txx + tyy), 0);
    m.setRowFromFloats(3, 0, 0, 0, 1);
    return m;
}

export const quatMul = (a: bjs.Quaternion, b: bjs.Quaternion) => {
    return a.multiply(b);
}

export const downloadString = (text: string, fileName: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', "test.txt");
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

import DataCSV from "../Rattleback.csv?raw"

const DATA : Array<{
    position: bjs.Vector3,
    rotation: bjs.Quaternion,
}> = []

const LINES = DataCSV.split("\n");
for  (let i = 1; i < LINES.length; i++) {
    // t, cx, cy, cz, qw, qx, qy, qz
    const line = LINES[i].split(",");
    const t = parseFloat(line[0]);
    const cx = parseFloat(line[1]);
    const cy = parseFloat(line[2]);
    const cz = parseFloat(line[3]);
    const qw = parseFloat(line[4]);
    const qx = parseFloat(line[5]);
    const qy = parseFloat(line[6]);
    const qz = parseFloat(line[7]);
    const position = new bjs.Vector3(cx, cy, cz);
    const rotation = new bjs.Quaternion(qx, qy, qz, qw);
    DATA.push({
        position,
        rotation
    })
}


export class Rattleback extends ITop {

    private c: bjs.Vector3;
    private B0: bjs.Matrix;
    private d: number;

    private rx: number;
    private ry: number;
    private rz: number;

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
        this.c = centerOfMass;
        this.d = d;
        this.simulationStepsPerFrame = 10;

        this.rx = rx;
        this.ry = ry;
        this.rz = rz;

        this.reset();
    }

    contactPoint(worldRotation: bjs.Matrix): bjs.Vector3 {
        const R = quaternionToMatrix(this.rotationQuaternion!);
        const B_inv = (R.multiply(this.B0.clone().multiply(R.transpose()))).invert();
        B_inv.setRowFromFloats(3, 0, 0, 0, 1);
        // extreme point in y-direction (upwards/downwards)
        let r = bjs.Vector3.TransformCoordinates(bjs.Vector3.Up(), B_inv).scale(
            -1 / Math.sqrt(
                bjs.Vector3.Dot(
                    bjs.Vector3.Up(),
                    bjs.Vector3.TransformCoordinates(
                        bjs.Vector3.Up(),
                        B_inv
                    )
                )
            )
        )
        const Re3 = bjs.Vector3.TransformCoordinates(bjs.Vector3.Up(), R)
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
            bjs.Vector3.TransformCoordinates(wxu, B_inv).scale(1 / s)
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
        // const R = new bjs.Matrix();
        // transform.q.toRotationMatrix(R);

        console.log("R", R);

        // I := inertia
        const I = R.multiply(this.momentOfInertia.clone().multiply(R.transpose()));
        // I.setRowFromFloats(3, 0, 0, 0, 1);
        console.log("I", I)
        const B_inv = R.multiply(this.B0.clone().multiply(R.transpose())).invert();
        // B_inv.setRowFromFloats(3, 0, 0, 0, 1);
        console.log("B_1", B_inv)

        // extreme point in y-direction (upwards/downwards)
        let r = bjs.Vector3.TransformCoordinates(bjs.Vector3.Up(), B_inv).scale(
            -Math.sqrt(
                bjs.Vector3.Dot(
                    bjs.Vector3.Up(),
                    bjs.Vector3.TransformCoordinates(
                        bjs.Vector3.Up(),
                        B_inv
                    )
                )
            )
        )
        console.log("r", r)
        let dr = this.drdt(r, B_inv, transform);
        console.log("dr", dr)

        const Re3 = bjs.Vector3.TransformCoordinates(bjs.Vector3.Up(), R)
        r = r.add(Re3.scale(this.d))
        console.log("r", r)

        dr = dr.add(bjs.Vector3.Cross(transform.w, Re3).scale(this.d))
        console.log("dr", dr)

        const I_INV = (I.clone().add(dyad(r, r).scale(-this.totalMass)).add(
            bjs.Matrix.Identity().scale(this.totalMass * bjs.Vector3.Dot(r, r))
        )).invert();
        I_INV.setRowFromFloats(3, 0, 0, 0, 1);
        console.log("I_1", I_INV)

        const rxu = bjs.Vector3.Cross(r, bjs.Vector3.Up()).scale(9.81 * this.totalMass);
        const wxIw = bjs.Vector3.Cross(
            transform.w,
            bjs.Vector3.TransformCoordinates(
                transform.w,
                I
            )
        );
        const rxwxdr = bjs.Vector3.Cross(
            r,
            bjs.Vector3.Cross(
                transform.w,
                dr
            )
        ).scale(this.totalMass);

        const u = rxu.subtract(wxIw).subtract(rxwxdr);
        console.log("u", u)

        const dw = bjs.Vector3.TransformCoordinates(u, I_INV)
        console.log("dw", dw)

        console.log("w", transform.w)
        const dv = bjs.Vector3.Cross(dw, r).scale(-1).subtract(
            bjs.Vector3.Cross(transform.w, dr)
        );
        console.log("dv", dv)

        const dc = transform.v.clone();
        console.log("dc", dc)

        const qw = new bjs.Quaternion(transform.w.x, transform.w.y, transform.w.z, 0);
        const dq = quatMul(qw, transform.q).scale(0.5);
        console.log("dq", dq)

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
            
            const k2 = this.dfdt(tmp)
            tmp = {
                q: transform.q.add(k2.q.scale(dt2)),
                p: transform.p.add(k2.p.scale(dt2)),
                v: transform.v.add(k2.v.scale(dt2)),
                w: transform.w.add(k2.w.scale(dt2))
            }

            const k3 = this.dfdt(tmp)
            tmp = {
                q: transform.q.add(k3.q.scale(dt)),
                p: transform.p.add(k3.p.scale(dt)),
                v: transform.v.add(k3.v.scale(dt)),
                w: transform.w.add(k3.w.scale(dt))
            }

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

        dt = 5e-4;

        // convert from left handed to right handed coordinate system
        const rotation = new bjs.Quaternion(
            this.rotationQuaternion!.x,
            this.rotationQuaternion!.y,
            this.rotationQuaternion!.z,
            this.rotationQuaternion!.w
        );

        const initial: Transform = {
            q: rotation,
            p: this.position.clone(),
            v: this.velocity.clone(),
            w: this.angularVelocity.clone()
        }

        const res = rk4(initial, dt);

        console.log(res);

        this.rotationQuaternion = new bjs.Quaternion(
            res.q.x,
            res.q.y,
            res.q.z,
            res.q.w
        );
        this.position = res.p;
        this.velocity = res.v;
        this.angularVelocity = res.w;


        
        s++;

    }
}

let s = 0;

export { }