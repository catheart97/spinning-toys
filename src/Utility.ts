import* as bjs from '@babylonjs/core'

export interface IUpdateable {
    update(dt: number): void
}

export const DiagMatrix = (x : number, y : number, z : number) : bjs.Matrix => {
    const mat = bjs.Matrix.Identity()
    mat.setRowFromFloats(0, x, 0, 0, 0)
    mat.setRowFromFloats(1, 0, y, 0, 0)
    mat.setRowFromFloats(2, 0, 0, z, 0)
    mat.setRowFromFloats(3, 0, 0, 0, 1)
    return mat;
}


export type Transform = {
    position: bjs.Vector3,
    rotation: bjs.Quaternion,
    veloctiy: bjs.Vector3,
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
    return dfdt(transform);
}

export const heun = (dfdt: (t: Transform) => Transform, transform: Transform, dt: number) : Transform => {
    const k1 = dfdt(transform);
    const k2 = dfdt({
        rotation: transform.rotation.add(k1.rotation.scale(dt)),
        position: transform.position.add(k1.position.scale(dt)),
        veloctiy: transform.veloctiy.add(k1.veloctiy.scale(dt)),
        angularVelocity: transform.angularVelocity.add(k1.angularVelocity.scale(dt))
    })

    return {
        rotation: transform.rotation.add(
            k1.rotation.add(k2.rotation).scale(dt / 2)
        ),
        position: transform.position.add(
            k1.position.add(k2.position).scale(dt / 2)
        ),
        veloctiy: transform.veloctiy.add(
            k1.veloctiy.add(k2.veloctiy).scale(dt / 2)
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
        veloctiy: transform.veloctiy.add(k1.veloctiy.scale(dt2)),
        angularVelocity: transform.angularVelocity.add(k1.angularVelocity.scale(dt2))
    }
    tmp.rotation.normalize();
    
    const k2 = dfdt(tmp)
    tmp = {
        rotation: transform.rotation.add(k2.rotation.scale(dt2)),
        position: transform.position.add(k2.position.scale(dt2)),
        veloctiy: transform.veloctiy.add(k2.veloctiy.scale(dt2)),
        angularVelocity: transform.angularVelocity.add(k2.angularVelocity.scale(dt2))
    }
    tmp.rotation.normalize();

    const k3 = dfdt(tmp)
    tmp = {
        rotation: transform.rotation.add(k3.rotation.scale(dt)),
        position: transform.position.add(k3.position.scale(dt)),
        veloctiy: transform.veloctiy.add(k3.veloctiy.scale(dt)),
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
        veloctiy: transform.veloctiy.add(
            k1.veloctiy.add(k4.veloctiy).scale(dt6).add(
                k2.veloctiy.add(k3.veloctiy).scale(dt3)
            )
        ),
        angularVelocity: transform.angularVelocity.add(
            k1.angularVelocity.add(k4.angularVelocity).scale(dt6).add(
                k2.angularVelocity.add(k3.angularVelocity).scale(dt3)
            )
        )
    }
}