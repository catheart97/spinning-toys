from vedo import *
from vedo.applications import AnimationPlayer
import csv 
import numpy as np
from scipy.spatial.transform import Rotation as R

# Read the data from the csv file
with open('Rattleback.csv', 'r') as f:
    reader = csv.reader(f)
    data = list(reader)

# schema t,cx,cy,cz,qw,qx,qy,qz,vx,vy,vz,wx,wy,wz
# t: time
# c: position
# q: rotation
# v: velocity
# w: angular velocity

# Create a list of positions and rotations
positions = []
rotations = []

for i in range(1, len(data)):
    positions.append([float(data[i][1]), float(data[i][2]), float(data[i][3])])
    rotations.append([float(data[i][5]), float(data[i][6]), float(data[i][7]), float(data[i][4])])

obj = Cube(pos=positions[0], side=0.1, c='red')

skip = 10

def step(i):
    if i % skip == 0:
        obj.pos(positions[i])
        rot = R.from_quat(rotations[i])
        axis = np.array(R.as_rotvec(rot))
        normAxis = axis / np.linalg.norm(axis)
        angle = np.linalg.norm(axis)
        obj.orientation(normAxis, angle, rad=True)
        player.render()

player = AnimationPlayer(
    step,
    (0, len(positions)-1),
    loop=True,
    dt=0.1 * 1/skip,
)

axes = Axes(
    xrange=(-1, 1), 
    yrange=(0, 1), 
    zrange=(-1, 1), 
    c='black', 
    alpha=0.2,
    xygrid=False,
    zxgrid=True,
)
player.show(obj, axes=axes)