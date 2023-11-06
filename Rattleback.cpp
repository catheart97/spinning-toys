#include "Eigen/Dense"
#include <iomanip>
#include <iostream>
#include <fstream>

using namespace Eigen;

const Vector3d e3(0.0, 1.0, 0.0);
const Vector3d p(0.5, 0.0, 0.5);
const double g = 9.81;
const double mE = 0.1 * 100;
const double mp = 0.05 * 100;

Matrix3d I0, B0;
double m, d;

// Explizite numerische Loesungsverfahren fuer eine gewoehnliche
// Differentialgleichung erster Ordnung: dy/dt = f(t,y) Gesucht ist y(t)

// n = Dimension von y
// t = Zeit
// h = Schrittweite
// y_in = Startwerte zum Zeitpunkt t
// y_out = Endwerte zum Zeitpunkt t+h
// f = rechte Seite

template <typename T> void print(const char *label, T &v) {
  std::cout << label << " = (";
  for (Eigen::Index i = 0; i < v.size(); ++i) {
    std::cout << v[i];
    if (i != v.size() - 1) {
      std::cout << ", ";
    }
  }
  std::cout << ")" << std::endl;
}

void print(const char *label, Matrix3d &m) {
  for (Eigen::Index i = 0; i < m.rows(); ++i) {

    if (i == m.rows() / 2) {
      std::cout << label << " = |";
    } else {
      for (size_t i = 0; i < strlen(label) + 3; ++i) {
        std::cout << " ";
      }
      std::cout << "|";
    }

    for (Eigen::Index j = 0; j < m.cols(); ++j) {
      std::cout << m(i, j);
      if (j != m.cols() - 1) {
        std::cout << ", ";
      }
    }
    std::cout << "|" << std::endl;
  }
}

void print(const char *label, Quaterniond &q) { print(label, q.coeffs()); }

// Euler: 1.Ordnung
VectorXd euler(double t, double h, VectorXd &y_in,
               VectorXd (*f)(double, VectorXd &)) {
  VectorXd k1 = (*f)(t, y_in);
  return (y_in + k1 * h);
}

// Heun: 2.Ordnung
VectorXd heun(double t, double h, VectorXd &y_in,
              VectorXd (*f)(double, VectorXd &)) {
  double h2 = h / 2.0;

  VectorXd k1 = (*f)(t, y_in);
  VectorXd y = y_in + k1 * h;
  VectorXd k2 = (*f)(t + h, y);
  return (y_in + (k1 + k2) * h2);
}

// Runge-Kutta: 4.Ordnung
VectorXd rk4(double t, double h, VectorXd &y_in,
             VectorXd (*f)(double, VectorXd &)) {
  double h2 = h / 2.0;
  double h3 = h / 3.0;
  double h6 = h / 6.0;

  VectorXd k1 = (*f)(t, y_in);
  VectorXd y = y_in + k1 * h2;
  VectorXd k2 = (*f)(t + h2, y);
  y = y_in + k2 * h2;
  VectorXd k3 = (*f)(t + h2, y);
  y = y_in + k3 * h;
  VectorXd k4 = (*f)(t + h, y);
  return (y_in + (k1 + k4) * h6 + (k2 + k3) * h3);
}

void inertia(double a, double b, double c) {
  double a2 = a * a;
  double b2 = b * b;
  double c2 = c * c;

  m = mE + 2 * mp;

  B0 << 1.0 / a2, 0.0, 0.0, 0.0, 1.0 / b2, 0.0, 0.0, 0.0, 1.0 / c2;

  double Ixx = 0.2 * mE * (b2 + c2);
  double Iyy = 0.2 * mE * (a2 + c2);
  double Izz = 0.2 * mE * (a2 + b2);

  I0 << Ixx, 0.0, 0.0, 0.0, Iyy, 0.0, 0.0, 0.0, Izz;

  Matrix3d P = p.dot(p) * Matrix3d::Identity() - p * p.transpose();

  d = mE / m * 3.0 * c / 8.0;
  Vector3d cr(0.0, -d, 0.0);
  Matrix3d CR = cr.dot(cr) * Matrix3d::Identity() - cr * cr.transpose();

  I0 = I0 + 2 * mp * P - m * CR;

  print("I0", I0);
  print("B0", B0);
}

Vector3d drdt(Vector3d &w, Vector3d &r, Matrix3d &B_1) {
  double s = -e3.transpose() * r;
  return (w.cross(r) + B_1 * w.cross(e3) / s +
          r * (e3.transpose() * w.cross(r) / s));
}

VectorXd dfdt(double, VectorXd &y) {
  Vector3d c(y[0], y[1], y[2]);
  Quaterniond q(y[3], y[4], y[5], y[6]);
  Vector3d v(y[7], y[8], y[9]);
  Vector3d w(y[10], y[11], y[12]);

  print("c", c);
  print("q", q);
  print("v", v);
  print("w", w);

  Matrix3d R = q.toRotationMatrix();
  print("R", R);


  Matrix3d RT = R.transpose();
  Matrix3d B = R * B0 * RT;
  Matrix3d B_1 = B.inverse();
  Matrix3d I = R * I0 * RT;
  Matrix3d E = Matrix3d::Identity();

  print("I", I);
  print("B_1", B_1);

  Vector3d r = -B_1 * e3 / sqrt(e3.transpose() * B_1 * e3);

  print("r", r);

  
  Vector3d dr = drdt(w, r, B_1);
  r = r + d * R * e3;
  print("dr", dr);

  print("r", r);
  dr = dr + d * w.cross(R * e3);
  print("dr", dr);

  double r2 = r.dot(r);
  Matrix3d I_1 = (I - r * r.transpose() * m + E * (m * r2)).inverse();
  print("I_1", I_1);

  Vector3d u = r.cross(e3) * m * g - w.cross(I * w) - r.cross(w.cross(dr)) * m;
  print("u", u);

  Vector3d dw = I_1 * u;
  print("dw", dw);
  Vector3d dv = -dw.cross(r) - w.cross(dr);
  print("dv", dv);
  Vector3d dc = v;
  print("dc", dc);
  Quaterniond qw(0.0, w.x(), w.y(), w.z());
  Quaterniond dq((qw * q).coeffs() * 0.5);
  print("dq", dq);

  VectorXd dy(13);
  dy << dc[0], dc[1], dc[2], dq.w(), dq.x(), dq.y(), dq.z(), dv[0], dv[1],
      dv[2], dw[0], dw[1], dw[2];
  return (dy);
}

int main() {
  double goldenratio = 0.5 * (1.0 + sqrt(5.0));
  inertia(goldenratio, 1.0, 1.0);
  Vector3d c(0.0, 1.0 - d, 0.0);
  print("c", c);
  Quaterniond q(1.0, 0.0, 0.0, 0.0);
  print("q", q);
  Vector3d w(0.01, 2.0, -0.02);
  print("w", w);

  Matrix3d R = q.toRotationMatrix();
  Matrix3d RT = R.transpose();
  Matrix3d B = R * B0 * RT;
  Matrix3d B_1 = B.inverse();
  Matrix3d I;

  Vector3d r = -B_1 * e3 / sqrt(e3.transpose() * B_1 * e3);
  r = r + d * R * e3;
  Vector3d v = r.cross(w);
  VectorXd y(13);
  y << c[0], c[1], c[2], q.w(), q.x(), q.y(), q.z(), v[0], v[1], v[2], w[0],
      w[1], w[2];

  std::fstream file("Rattleback.csv", std::ios::out);
  file << "t,cx,cy,cz,qw,qx,qy,qz,vx,vy,vz,wx,wy,wz" << std::endl;

  double h = 5e-4;
  int step = 1;
  for (double t = 0.0; t < 60.0; t += h) {
    c = Vector3d(y[0], y[1], y[2]);
    q = Quaterniond(y[3], y[4], y[5], y[6]);
    v = Vector3d(y[7], y[8], y[9]);
    w = Vector3d(y[10], y[11], y[12]);


    file << t << "," << c[0] << "," << c[1] << "," << c[2] << "," << q.w() << ","
         << q.x() << "," << q.y() << "," << q.z() << "," << v[0] << "," << v[1]
         << "," << v[2] << "," << w[0] << "," << w[1] << "," << w[2]
         << std::endl;

    R = q.toRotationMatrix();
    RT = R.transpose();
    B = R * B0 * RT;
    B_1 = B.inverse();
    I = R * I0 * RT;
    y = rk4(t, h, y, dfdt);

    // Vector3d

    c = Vector3d(y[0], y[1], y[2]);
    q = Quaterniond(y[3], y[4], y[5], y[6]);
    v = Vector3d(y[7], y[8], y[9]);
    w = Vector3d(y[10], y[11], y[12]);

    std::cout << "After " << step << " Step: " << std::endl;
    print("c", c);
    print("q", q);
    print("v", v);
    print("w", w);

    ++step;

    if (step == 50) {
      exit(0);
    }


  }
}
