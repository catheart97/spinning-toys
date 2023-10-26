import * as bjs from '@babylonjs/core'
import { dyad } from './Tools';

let _material: bjs.PBRMetallicRoughnessMaterial | undefined = undefined;
export const TopMaterial = (scene: bjs.Scene) => {
    if (_material && _material.getScene() == scene) return _material;
    else {
        const material = new bjs.PBRMetallicRoughnessMaterial("top#material", scene);
        material.roughness = 0.1;
        material.metallicRoughnessTexture = new bjs.Texture("Metal012_1K-JPG/Metal012_1K_Metalness.jpg", scene)
        material.baseTexture = new bjs.Texture("Metal012_1K-JPG/Metal012_1K_Color.jpg", scene)
        material.normalTexture = new bjs.Texture("Metal012_1K-JPG/Metal012_1K_NormalGL.jpg", scene)
        _material = material;
        return material;
    }
}

export const GRAVITY = bjs.Vector3.Down().scale(9.81);
export const PHI = 1.6180339887;

export const steiner = (offset: bjs.Vector3, mass: number) => {
    const negDyad = dyad(
        offset, offset
    ).scale(-1);
    const dotIdentity = bjs.Matrix.Identity().scale(
        bjs.Vector3.Dot(offset, offset)
    );
    const t = dotIdentity.add(negDyad);
    return t.scale(mass);
}

export type SimulationDataEntry = {
    time: number,
    velocity: bjs.Vector3,
    angularVelocity: bjs.Vector3,
    kineticEnergy: number,
    rotationalEnergy: number,
    potentialEnergy: number,
    totalEnergy: number,
}

export type SimulationData = SimulationDataEntry[]

export abstract class ITop extends bjs.TransformNode {

    protected momentOfInertia: bjs.Matrix = bjs.Matrix.Identity();
    protected totalMass : number;

    protected angularVelocity: bjs.Vector3 = bjs.Vector3.Zero();
    protected velocity: bjs.Vector3 = bjs.Vector3.Zero();

    protected _time: number = 0;

    private _simulationData: SimulationData = []
    get simulationData() {
        return this._simulationData;
    }

    public simulationStepsPerFrame: number = 1;

    protected constructor(name: string, scene: bjs.Scene, momentOfInertia: bjs.Matrix, totalMass: number) {
        super(name, scene);
        this.momentOfInertia = momentOfInertia.clone();
        this.totalMass = totalMass;
        this.rotationQuaternion = bjs.Quaternion.Identity();
        this.reset();
    }

    reset() {
        this._simulationData = [];
        this.angularVelocity = bjs.Vector3.Zero();
        this.velocity = bjs.Vector3.Zero();
        this.rotationQuaternion = bjs.Quaternion.Identity();
        this._time = 0;
    }

    abstract step(dt: number, world: bjs.Matrix, inertia : bjs.Matrix): void;
    abstract contactPoint(world: bjs.Matrix): bjs.Vector3

    tick(simulate: boolean) : void {

        // Drag Object towards center
        const dt = this.getScene().getEngine().getDeltaTime() / 1000;
        const coreAcc = this.position.scale(-1);
        coreAcc.y = 0;
        this.position.addInPlace(coreAcc.scale(dt));

        if (simulate) {

            const dt = (this.getScene().getEngine().getDeltaTime() / 1000) / this.simulationStepsPerFrame;

            for (let i = 0; i < this.simulationStepsPerFrame; ++i) {

                const world = this.getWorldMatrix().getRotationMatrix();
                const inertia = world.transpose().multiply(this.momentOfInertia.clone()).multiply(world);

                this.step(dt, world, inertia);

                // save graph data
                this._time += dt;
                // if (i == this.simulationStepsPerFrame - 1) {

                //     const Ekin = 0.5 * this.velocity.lengthSquared() * this.totalMass;
                //     const Erot = 0.5 * bjs.Vector3.Dot(
                //         bjs.Vector3.TransformCoordinates(
                //             this.angularVelocity,
                //             inertia
                //         ),
                //         this.angularVelocity
                //     );
                //     const Epot = -this.getAbsolutePosition().y * this.totalMass * GRAVITY.length();

                //     this.simulationData.push({
                //         time: this._time,
                //         velocity: this.velocity.clone(),
                //         angularVelocity: this.angularVelocity.clone(),
                //         kineticEnergy: Ekin,
                //         rotationalEnergy: Erot,
                //         potentialEnergy: Epot,
                //         totalEnergy: Ekin + Erot + Epot
                //     })
                // }
            }
            const world = this.getWorldMatrix().getRotationMatrix();
            const pWorld = this.contactPoint(world);
            const pos = this.getAbsolutePosition().clone();
            pos.y = -pWorld.y;
            this.setAbsolutePosition(pos)
        } else {
            const world = this.getWorldMatrix().getRotationMatrix();
            const pWorld = this.contactPoint(world);
            this.position.y = -pWorld.y;
        }
    }
}