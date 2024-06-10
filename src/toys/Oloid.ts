import * as bjs from '@babylonjs/core';
import '@babylonjs/loaders'
import { DiagMatrix, IUpdateable, Transform } from '../Utility';

export class Oloid implements IUpdateable {

    public simulate: boolean = false;
    public velocity = new bjs.Vector3(0, 0, 0)
    public angularVelocity = new bjs.Vector3(0, 0, 0)

    public get position(): bjs.Vector3 {
        return this.core.position;
    }

    public get rotation(): bjs.Quaternion {
        return this.core.rotationQuaternion!;
    }

    circleNormals = [
        new bjs.Vector3(0, 1, 0),
        new bjs.Vector3(0, 0, 1),
    ]

    circleOffsets = [
        new bjs.Vector3(-.5, 0, 0),
        new bjs.Vector3(0.5, 0, 0),
    ]

    core: bjs.TransformNode
    line: bjs.LinesMesh

    mass: number
    momentOfIntertia: bjs.Matrix // I0


    constructor(mesh: bjs.Mesh) {
        mesh.getChildMeshes(false).forEach(m => {
            if (m.material) {
                m.material.wireframe = true
            }
        });

        this.core = new bjs.TransformNode("core", mesh.getScene())
        this.core.rotationQuaternion = new bjs.Quaternion();
        mesh.parent = this.core;

        // const circleMaterial = new bjs.StandardMaterial("circleMaterial", this.core.getScene())
        // circleMaterial.diffuseColor = new bjs.Color3(0, 0, 0)
        // circleMaterial.backFaceCulling = false;
        // {
        //     const circle = bjs.CreateDisc(
        //         "circle", {
        //         radius: 1
        //     }, this.core.getScene()
        //     )
        //     circle.rotation.x = Math.PI / 2;
        //     circle.position = this.circleOffsets[0];
        //     circle.material = circleMaterial;
        //     circle.parent = this.core;
        // }
        // {
        //     const circle = bjs.CreateDisc(
        //         "circle", {
        //         radius: 1
        //     }, this.core.getScene()
        //     )
        //     circle.rotation.z = Math.PI / 2;
        //     circle.position = this.circleOffsets[1];
        //     circle.material = circleMaterial;
        //     circle.parent = this.core;
        // }

        this.line = bjs.MeshBuilder.CreateLines("line", {
            points: [
                new bjs.Vector3(-1, 0, 0),
                new bjs.Vector3(1, 0, 0),
            ],
            updatable: true,
            colors: [
                new bjs.Color4(1, 0, 0, 1),
                new bjs.Color4(1, 0, 0, 1),
            ]
        }, this.core.getScene())

        // simulation stuff 
        this.mass = 1;
        this.momentOfIntertia = DiagMatrix(
            this.mass * 0.250738, 
            this.mass * 0.476839, 
            this.mass * 0.476839
        );
    }

    private contactPointOnCircle(n: bjs.Vector3, up: bjs.Vector3, offset: bjs.Vector3) {
        return n.cross(n.cross(up)).normalize().add(offset)
    }

    contactPoints(rotMatrix: bjs.Matrix, iRotMatrix: bjs.Matrix) {
        const upInCore = bjs.Vector3.TransformCoordinates(bjs.Vector3.Up(), iRotMatrix)
        const c1 = this.contactPointOnCircle(this.circleNormals[0], upInCore, this.circleOffsets[0])
        const c1n = c1.negate();
        const c2 = this.contactPointOnCircle(this.circleNormals[1], upInCore, this.circleOffsets[1])
        const c2n = c2.negate();
        
        const cs : Array<[bjs.Vector3, number]> = [ 
            [c1, bjs.Vector3.Dot(c1, upInCore)],
            [c1n, bjs.Vector3.Dot(c1n, upInCore)],
            [c2, bjs.Vector3.Dot(c2, upInCore)],
            [c2n, bjs.Vector3.Dot(c2n, upInCore)]
        ]
        cs.sort((a, b) => b[1] - a[1]) // sort such that smalles csp value is first

        if (Math.abs(cs[0][1] - cs[1][1]) < 0.001) {
            return [ 
                bjs.Vector3.TransformCoordinates(cs[0][0], rotMatrix), 
                bjs.Vector3.TransformCoordinates(cs[1][0], rotMatrix) 
            ]
        }

        return [
            bjs.Vector3.TransformCoordinates(cs[0][0], rotMatrix)
        ]
    }


    private dfdt(t: Transform) {

        const rotMatrix = new bjs.Matrix()
        t.rotation.toRotationMatrix(rotMatrix);
        const iRotMatrix = rotMatrix.clone().invert()

        const contactPoints = this.contactPoints(rotMatrix, iRotMatrix)

    }

    delta = 0

    // IUpdateable
    update(dt: number) {

        
        // this.core.rotate(bjs.Axis.Y, 0.01, bjs.Space.LOCAL)


        const rotMatrix = new bjs.Matrix()
        this.core.rotationQuaternion.toRotationMatrix(rotMatrix);
        const iRotMatrix = rotMatrix.clone().invert()

        const contactPoints = this.contactPoints(rotMatrix, iRotMatrix)
        this.core.position.y = contactPoints[0].y;

        if (contactPoints.length == 1) {
            this.core.rotate(bjs.Axis.X, 0.01, bjs.Space.LOCAL)
            console.log("1")
        } else {
            const p0 = contactPoints[0].clone()
            const p1 = contactPoints[1].clone()
                        
            p0.negateInPlace()
            p1.negateInPlace()

            p0.y = 0.01
            p1.y = 0.01

            bjs.MeshBuilder.CreateLines("line", {
                points: [
                    p0,
                    p1
                ],
                updatable: true,
                instance: this.line
            }, this.core.getScene())

            const axis = contactPoints[0].subtract(contactPoints[1]).normalize()
            this.core.rotate(axis, 0.01, bjs.Space.WORLD)
        }

        const t = {
            position: this.core.position,
            rotation: this.core.rotationQuaternion,
            veloctiy: this.velocity,
            angularVelocity: this.angularVelocity
        }
        
    }
}