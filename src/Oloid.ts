import * as bjs from '@babylonjs/core';
import '@babylonjs/loaders'
import { IUpdateable } from './IUpdateable';

export class Oloid implements IUpdateable {

    circleNormals = [
        new bjs.Vector3(0, 1, 0),
        new bjs.Vector3(0, 0, 1),
    ]

    circleOffsets = [
        new bjs.Vector3(0.5, 0, 0),
        new bjs.Vector3(-.5, 0, 0),
    ]

    core: bjs.TransformNode

    // all transforms
    constructor(mesh: bjs.Mesh) {
        mesh.getChildMeshes(false).forEach(m => {
            if (m.material) {
                m.material.wireframe = true
            }
        });

        this.core = new bjs.TransformNode("core", mesh.getScene())
        this.core.rotationQuaternion = new bjs.Quaternion();
        mesh.parent = this.core;

        const circleMaterial = new bjs.StandardMaterial("circleMaterial", this.core.getScene())
        circleMaterial.diffuseColor = new bjs.Color3(0, 0, 0)
        circleMaterial.backFaceCulling = false;
        {
            const circle = bjs.CreateDisc(
                "circle", {
                radius: 1
            }, this.core.getScene()
            )
            circle.rotation.x = Math.PI / 2;
            circle.position = this.circleOffsets[0].negate();
            circle.material = circleMaterial;
            circle.parent = this.core;
        }
        {
            const circle = bjs.CreateDisc(
                "circle", {
                radius: 1
            }, this.core.getScene()
            )
            circle.rotation.z = Math.PI / 2;
            circle.position = this.circleOffsets[1].negate();
            circle.material = circleMaterial;
            circle.parent = this.core;
        }
    }

    contactPoint() {
        const rotMatrix = new bjs.Matrix()
        this.core.rotationQuaternion.toRotationMatrix(rotMatrix);
        const iRotMatrix = rotMatrix.invert()

        const normalsInWorld = this.circleNormals.map(n => bjs.Vector3.TransformCoordinates(n, iRotMatrix))
        const offsetsInWorld = this.circleOffsets.map(o => bjs.Vector3.TransformCoordinates(o, iRotMatrix))

        const c1w = this.contactPointOnCircle(normalsInWorld[0], bjs.Vector3.Up(), offsetsInWorld[0])
        const c2w = this.contactPointOnCircle(normalsInWorld[1], bjs.Vector3.Up(), offsetsInWorld[1])

        const cw = [
            c1w, 
            c1w.negate(), 
            c2w,
            c2w.negate()
        ]
        return cw.reduce((a, b) => a.y > b.y ? a : b)
    }

    private contactPointOnCircle(n: bjs.Vector3, up: bjs.Vector3, offset: bjs.Vector3) {
        return n.cross(n.cross(up)).normalize().add(offset)
    }
    
    // IUpdateable
    async init() { }

    // IUpdateable
    update(dt: number) {
        this.core.rotate(bjs.Vector3.Left(), 0.01);
        this.core.rotate(bjs.Vector3.Forward(), 0.01);
        this.core.position.y = this.contactPoint().y;
    }
}