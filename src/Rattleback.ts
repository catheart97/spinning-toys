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

export const downloadString = (text: string, fileName: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', "test.txt");
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

export class Rattleback extends ITop {

    private c: bjs.Vector3;
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

        scene.removeMesh(ellipsoid);
        scene.removeMesh(box);

        const massP = 0.05 * 100;
        const p = new bjs.Vector3(0.5, 0, 0.5);

        const totalMass = 2 * massP + massE;
        const d = massE / totalMass * 3 * ry / 8;
        const centerOfMass = new bjs.Vector3(0, d, 0);
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

        mesh.position = centerOfMass;
        mesh.parent = this;
        this.c = centerOfMass;
        this.d = d;
        this.simulationStepsPerFrame = 1;
        this.reset();
    }

    contactPoint(worldRotation: bjs.Matrix): bjs.Vector3 {
        const world = worldRotation.clone();
        const B_inv = (world.multiply(this.B0.clone().multiply(world.transpose()))).invert();
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
        const Re3 = bjs.Vector3.TransformCoordinates(bjs.Vector3.Up(), world)
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

        const world = new bjs.Matrix();
        transform.q.toRotationMatrix(world);
        
        const inertia = world.multiply(this.momentOfInertia.multiply(world.transpose()));
        inertia.setRowFromFloats(3, 0, 0, 0, 1);
        console.log("I", inertia)
        const B_inv = world.multiply(this.B0.clone().multiply(world.transpose())).invert();
        B_inv.setRowFromFloats(3, 0, 0, 0, 1);
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

        // derivative of contact point
        let dr = this.drdt(r, B_inv, transform);
        console.log("dr", dr)

        const Re3 = bjs.Vector3.TransformCoordinates(bjs.Vector3.Up(), world)
        r = r.add(Re3.scale(this.d))
        console.log("r", r)
        dr = dr.add(bjs.Vector3.Cross(transform.w, Re3).scale(this.d))
        console.log("dr", dr)

        const I_INV = inertia.clone().add(dyad(r, r).scale(-this.totalMass)).add(
            bjs.Matrix.Identity().scale(this.totalMass * bjs.Vector3.Dot(r, r))
        ).invert();
        I_INV.setRowFromFloats(3, 0, 0, 0, 1);
        console.log("I_1", I_INV)

        const rxu = bjs.Vector3.Cross(r, bjs.Vector3.Up()).scale(9.81 * this.totalMass);
        const wxIw = bjs.Vector3.Cross(
            transform.w,
            bjs.Vector3.TransformCoordinates(
                transform.w,
                inertia
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

        const dv = bjs.Vector3.Cross(r, dw).add(
            bjs.Vector3.Cross(dr, transform.w)
        );
        console.log("dv", dv)

        const dc = transform.v.clone();
        console.log("dc", dc)

        const qw = new bjs.Quaternion(transform.w.x, transform.w.y, transform.w.z, 0);
        const dq = qw.multiply(transform.q).scale(0.5);
        console.log("dq", dq)

        return {
            p: dc,
            q: dq,
            v: dv,
            w: dw
        }
    }

    step(dt: number, _world: bjs.Matrix, _inertia: bjs.Matrix): void {

        dt = 5e-4;

        const initial: Transform = {
            q: this.rotationQuaternion!.clone(),
            p: this.position.clone(),
            v: this.velocity.clone(),
            w: this.angularVelocity.clone()
        }
        

        const euler = (transform: Transform, dt: number) => {
            const k1 = this.dfdt(transform);
            this.rotationQuaternion = this.rotationQuaternion!.add(k1.q.scale(dt));
            this.velocity = this.velocity.add(k1.v.scale(dt));
            this.angularVelocity = this.angularVelocity.add(k1.w.scale(dt));
            this.position = this.position.add(k1.p.scale(dt));

            console.log("q", this.rotationQuaternion!)
            console.log("v", this.velocity)
            console.log("w", this.angularVelocity)
            console.log("c", this.position)

        }

        const heun = (transform: Transform, dt: number) => {
            const k1 = this.dfdt(transform);
            const k2 = this.dfdt({
                q: transform.q.add(k1.q.scale(dt)),
                p: transform.p.add(k1.p.scale(dt)),
                v: transform.v.add(k1.v.scale(dt)),
                w: transform.w.add(k1.w.scale(dt))
            })

            this.rotationQuaternion = this.rotationQuaternion!.add(k1.q.add(k2.q).scale(0.5 * dt));
            this.velocity = this.velocity.add(k1.v.add(k2.v).scale(0.5 * dt));
            this.angularVelocity = this.angularVelocity.add(k1.w.add(k2.w).scale(0.5 * dt));
            this.position = this.position.add(k1.p.add(k2.p).scale(0.5 * dt));
        }

        const rk4 = (transform: Transform, dt: number) => {
            const k1 = this.dfdt(transform);
            const k2 = this.dfdt({
                q: transform.q.add(k1.q.scale(0.5 * dt)).normalize(),
                p: transform.p.add(k1.p.scale(0.5 * dt)),
                v: transform.v.add(k1.v.scale(0.5 * dt)),
                w: transform.w.add(k1.w.scale(0.5 * dt))
            })
            const k3 = this.dfdt({
                q: transform.q.add(k2.q.scale(0.5 * dt)).normalize(),
                p: transform.p.add(k2.p.scale(0.5 * dt)),
                v: transform.v.add(k2.v.scale(0.5 * dt)),
                w: transform.w.add(k2.w.scale(0.5 * dt))
            })
            const k4 = this.dfdt({
                q: transform.q.add(k3.q.scale(dt)).normalize(),
                p: transform.p.add(k3.p.scale(dt)),
                v: transform.v.add(k3.v.scale(dt)),
                w: transform.w.add(k3.w.scale(dt))
            })

            this.rotationQuaternion = this.rotationQuaternion!.add(k1.q.add(k2.q.scale(2)).add(k3.q.scale(2)).add(k4.q).scale(dt / 6));
            this.velocity = this.velocity.add(k1.v.add(k2.v.scale(2)).add(k3.v.scale(2)).add(k4.v).scale(dt / 6));
            this.angularVelocity = this.angularVelocity.add(k1.w.add(k2.w.scale(2)).add(k3.w.scale(2)).add(k4.w).scale(dt / 6));
            this.position = this.position.add(k1.p.add(k2.p.scale(2)).add(k3.p.scale(2)).add(k4.p).scale(dt / 6));
        }

        if (s == 0) {
            // console.log("Initial Transform", initial);
            euler(initial, dt);
            this.rotationQuaternion!.normalize();
        }

        // this.position.y = -this.contactPoint(_world).y;

        // s += 1;
        // s = s % 200;
    }
}

let s = 0;

export { }