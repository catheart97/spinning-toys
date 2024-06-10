import* as bjs from '@babylonjs/core'

export interface IUpdateable {
    update(dt: number): void
    get position(): bjs.Vector3
    get rotation(): bjs.Quaternion
    angularVelocity: bjs.Vector3
    velocity: bjs.Vector3
    simulate: boolean
}

export const CrossMatrix = (v: bjs.Vector3) : bjs.Matrix => {
    return bjs.Matrix.FromArray([
        0, -v.z, v.y, 0,
        v.z, 0, -v.x, 0,
        -v.y, v.x, 0, 0,
        0, 0, 0, 1
    ])
}

export const DiagMatrix = (x : number, y : number, z : number) : bjs.Matrix => {
    const mat = bjs.Matrix.Identity()
    mat.setRowFromFloats(0, x, 0, 0, 0)
    mat.setRowFromFloats(1, 0, y, 0, 0)
    mat.setRowFromFloats(2, 0, 0, z, 0)
    mat.setRowFromFloats(3, 0, 0, 0, 1)
    return mat;
}

export const vecMul = (a: bjs.Matrix, v: bjs.Vector3) => {
    const res = new bjs.Vector3();
    res.x = a.m[0] * v.x + a.m[1] * v.y + a.m[2] * v.z;
    res.y = a.m[4] * v.x + a.m[5] * v.y + a.m[6] * v.z;
    res.z = a.m[8] * v.x + a.m[9] * v.y + a.m[10] * v.z;
    return res;
}

export const matMul = (a: bjs.Matrix, b: bjs.Matrix) => {
    return bjs.Matrix.FromArray([
        a.m[0] * b.m[0] + a.m[1] * b.m[4] + a.m[2] * b.m[8], 
        a.m[0] * b.m[1] + a.m[1] * b.m[5] + a.m[2] * b.m[9], 
        a.m[0] * b.m[2] + a.m[1] * b.m[6] + a.m[2] * b.m[10], 
        0,
        a.m[4] * b.m[0] + a.m[5] * b.m[4] + a.m[6] * b.m[8], 
        a.m[4] * b.m[1] + a.m[5] * b.m[5] + a.m[6] * b.m[9], 
        a.m[4] * b.m[2] + a.m[5] * b.m[6] + a.m[6] * b.m[10], 
        0,
        a.m[8] * b.m[0] + a.m[9] * b.m[4] + a.m[10] * b.m[8],
        a.m[8] * b.m[1] + a.m[9] * b.m[5] + a.m[10] * b.m[9], 
        a.m[8] * b.m[2] + a.m[9] * b.m[6] + a.m[10] * b.m[10], 
        0,
        0, 0, 0, 1
    ]);
};

export const dyad = (a: bjs.Vector3, b: bjs.Vector3) => {
    return bjs.Matrix.FromArray([
        a.x * b.x, a.x * b.y, a.x * b.z, 0,
        a.y * b.x, a.y * b.y, a.y * b.z, 0,
        a.z * b.x, a.z * b.y, a.z * b.z, 0,
        0, 0, 0, 1
    ])
}

export type Transform = {
    position: bjs.Vector3,
    rotation: bjs.Quaternion,
    velocity: bjs.Vector3,
    angularVelocity: bjs.Vector3
}

export const quaternionToMatrix = (q: bjs.Quaternion) => {
    let tq = q.clone();
    tq.normalize();
    tq.w = -tq.w;
    let R = new bjs.Matrix();
    tq.toRotationMatrix(R);
    return R;
}

export const euler = (dfdt: (t: Transform) => Transform, transform: Transform, dt: number) : Transform => {
    const k = dfdt(transform);
    return {
        rotation: transform.rotation.add(k.rotation.scale(dt)),
        position: transform.position.add(k.position.scale(dt)),
        velocity: transform.velocity.add(k.velocity.scale(dt)),
        angularVelocity: transform.angularVelocity.add(k.angularVelocity.scale(dt))
    
    }
}

export const heun = (dfdt: (t: Transform) => Transform, transform: Transform, dt: number) : Transform => {
    const k1 = dfdt(transform);
    const k2 = dfdt({
        rotation: transform.rotation.add(k1.rotation.scale(dt)),
        position: transform.position.add(k1.position.scale(dt)),
        velocity: transform.velocity.add(k1.velocity.scale(dt)),
        angularVelocity: transform.angularVelocity.add(k1.angularVelocity.scale(dt))
    })

    return {
        rotation: transform.rotation.add(
            k1.rotation.add(k2.rotation).scale(dt / 2)
        ),
        position: transform.position.add(
            k1.position.add(k2.position).scale(dt / 2)
        ),
        velocity: transform.velocity.add(
            k1.velocity.add(k2.velocity).scale(dt / 2)
        ),
        angularVelocity: transform.angularVelocity.add(
            k1.angularVelocity.add(k2.angularVelocity).scale(dt / 2)
        )
    }
}

export const rk4 = (dfdt: (t: Transform) => Transform, transform: Transform, dt: number) : Transform => {

    const dt2 = dt / 2;
    const dt3 = dt / 3;
    const dt6 = dt / 6;

    const k1 = dfdt(transform);
    let tmp : Transform = {
        rotation: transform.rotation.add(k1.rotation.scale(dt2)),
        position: transform.position.add(k1.position.scale(dt2)),
        velocity: transform.velocity.add(k1.velocity.scale(dt2)),
        angularVelocity: transform.angularVelocity.add(k1.angularVelocity.scale(dt2))
    }
    tmp.rotation.normalize();
    
    const k2 = dfdt(tmp)
    tmp = {
        rotation: transform.rotation.add(k2.rotation.scale(dt2)),
        position: transform.position.add(k2.position.scale(dt2)),
        velocity: transform.velocity.add(k2.velocity.scale(dt2)),
        angularVelocity: transform.angularVelocity.add(k2.angularVelocity.scale(dt2))
    }
    tmp.rotation.normalize();

    const k3 = dfdt(tmp)
    tmp = {
        rotation: transform.rotation.add(k3.rotation.scale(dt)),
        position: transform.position.add(k3.position.scale(dt)),
        velocity: transform.velocity.add(k3.velocity.scale(dt)),
        angularVelocity: transform.angularVelocity.add(k3.angularVelocity.scale(dt))
    }
    tmp.rotation.normalize();

    const k4 = dfdt(tmp)
    return {
        rotation: transform.rotation.add(
            k1.rotation.add(k4.rotation).scale(dt6).add(
                k2.rotation.add(k3.rotation).scale(dt3)
            )
        ),
        position: transform.position.add(
            k1.position.add(k4.position).scale(dt6).add(
                k2.position.add(k3.position).scale(dt3)
            )
        ),
        velocity: transform.velocity.add(
            k1.velocity.add(k4.velocity).scale(dt6).add(
                k2.velocity.add(k3.velocity).scale(dt3)
            )
        ),
        angularVelocity: transform.angularVelocity.add(
            k1.angularVelocity.add(k4.angularVelocity).scale(dt6).add(
                k2.angularVelocity.add(k3.angularVelocity).scale(dt3)
            )
        )
    }
}