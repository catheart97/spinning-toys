#include <iostream>
#include <iomanip>
#include "Eigen/Dense"

using namespace Eigen;

Vector3d e3(0.0,0.0,1.0);
Matrix3d I0,B0;
double g = 9.81;
double mE = 1.0;
double m,mu = 0.3;

// Explizite numerische Loesungsverfahren fuer eine gewoehnliche Differentialgleichung
// erster Ordnung: dy/dt = f(t,y)
// Gesucht ist y(t)

// n = Dimension von y
// t = Zeit
// h = Schrittweite
// y_in = Startwerte zum Zeitpunkt t
// y_out = Endwerte zum Zeitpunkt t+h
// f = rechte Seite

// Euler: 1.Ordnung
VectorXd euler(double t, double h, VectorXd& y_in, VectorXd (*f)(double,VectorXd&)) {
    VectorXd k1 = (*f)(t,y_in);
    return(y_in + k1*h);
}

// Heun: 2.Ordnung
VectorXd heun(double t, double h, VectorXd& y_in, VectorXd (*f)(double,VectorXd&)) {
    double h2 = h/2.0;

    VectorXd k1 = (*f)(t,y_in);
    VectorXd y = y_in + k1*h;
    VectorXd k2 = (*f)(t+h,y);
    return(y_in+(k1+k2)*h2);
}

// Runge-Kutta: 4.Ordnung
VectorXd rk4(double t, double h, VectorXd& y_in, VectorXd (*f)(double,VectorXd&)) {
    double h2 = h/2.0;
    double h3 = h/3.0;
    double h6 = h/6.0;

    VectorXd k1 = (*f)(t,y_in);
    VectorXd y = y_in + k1*h2;
    VectorXd k2 = (*f)(t+h2,y);
    y = y_in + k2*h2;
    VectorXd k3 = (*f)(t+h2,y);
    y = y_in + k3*h;
    VectorXd k4 = (*f)(t+h,y);
    return(y_in + (k1+k4)*h6 + (k2+k3)*h3);
}

void inertia(double a,double b,double c) {
    double a2 = a*a;
    double b2 = b*b;
    double c2 = c*c;

    m = mE;

    B0 << 1.0/a2,   0.0,   0.0,
             0.0,1.0/b2,   0.0,
             0.0,   0.0,1.0/c2;

    double Ixx = 0.2*mE*(b2+c2);
    double Iyy = 0.2*mE*(a2+c2);
    double Izz = 0.2*mE*(a2+b2);

    I0 << Ixx, 0.0, 0.0,
          0.0, Iyy, 0.0,
          0.0, 0.0, Izz;

    std::cout << "I0:" << std::endl;
    std::cout << I0(0,0) << " " << I0(0,1) << " " << I0(0,2) << std::endl;
    std::cout << I0(1,0) << " " << I0(1,1) << " " << I0(1,2) << std::endl;
    std::cout << I0(2,0) << " " << I0(2,1) << " " << I0(2,2) << std::endl;
}

Vector3d drdt(Vector3d& w,Vector3d& r,Matrix3d& B_1) {
//  double s = sqrt(e3.transpose()*B_1*e3);
    double s = -e3.transpose()*r;
    return(w.cross(r)+B_1*w.cross(e3)/s+r*(e3.transpose()*w.cross(r)/s));
//  return(w.cross(r)+B_1*w.cross(e3)/s+r*(e3.transpose()*B_1*w.cross(e3)/(s*s)));
//  return(w.cross(r)+e3.cross((B_1*w.cross(e3)).cross(B_1*e3))/(s*s*s));
}

VectorXd dfdt(double t,VectorXd& y) {
    Vector3d c(y[0],y[1],y[2]);
    Quaterniond q(y[3],y[4],y[5],y[6]);
    Vector3d v(y[7],y[8],y[9]);
    Vector3d w(y[10],y[11],y[12]);

    Matrix3d R = q.toRotationMatrix();
    Matrix3d RT = R.transpose();
    Matrix3d B = R*B0*RT;
    Matrix3d B_1 = B.inverse();
    Matrix3d I = R*I0*RT;
    Matrix3d E = Matrix3d::Identity();

    Vector3d r = -B_1*e3/sqrt(e3.transpose()*B_1*e3);
    Vector3d dr = drdt(w,r,B_1);
    Vector3d rxe3 = r.cross(e3);
    Vector3d wxdr = w.cross(dr);
    Vector3d vwxr = v+w.cross(r); 
    Matrix3d I_1 = (I+rxe3*rxe3.transpose()*m).inverse();
    Vector3d u = rxe3*(m*g-m*e3.dot(wxdr))-w.cross(I*w)-r.cross(vwxr)*mu;
    Vector3d dw = I_1*u;
    double   lambda = -e3.dot(dw.cross(r))-e3.dot(w.cross(dr));
    Vector3d dv = e3*lambda-vwxr*mu/m;
    Vector3d dc = v;
    Quaterniond qw(0.0,w.x(),w.y(),w.z());
    Quaterniond dq((qw*q).coeffs()*0.5);

    VectorXd dy(13);
    dy << dc[0],dc[1],dc[2],dq.w(),dq.x(),dq.y(),dq.z(),dv[0],dv[1],dv[2],dw[0],dw[1],dw[2];
    return(dy);
}

int main() {
    double goldenratio = 0.5*(1.0+sqrt(5.0));
    std::cout << goldenratio << std::endl;
    inertia(goldenratio,1.0,1.0);
    Vector3d c(0.0,0.0,1.0);
    std::cout << "c = " << c[0] << " " << c[1] << " " << c[2] << std::endl;
    Quaterniond q(1.0,0.0,0.0,0.0);
    Vector3d w(4.0,-1.0,25.0);

    Matrix3d R = q.toRotationMatrix();
    Matrix3d RT = R.transpose();
    Matrix3d B = R*B0*RT;
    Matrix3d B_1 = B.inverse();
    Matrix3d I;

    std::cout << "B0:" << std::endl;
    std::cout << B0(0,0) << " " << B0(0,1) << " " << B0(0,2) << std::endl;
    std::cout << B0(1,0) << " " << B0(1,1) << " " << B0(1,2) << std::endl;
    std::cout << B0(2,0) << " " << B0(2,1) << " " << B0(2,2) << std::endl;

    Vector3d r = -B_1*e3/sqrt(e3.transpose()*B_1*e3);
    std::cout << "r = " << r[0] << " " << r[1] << " " << r[2] << std::endl;
    Vector3d wxr = w.cross(r);
    std::cout << "w x r = " << wxr[0] << " " << wxr[1] << " " << wxr[2] << std::endl;
    Vector3d v(0.0,0.0,-e3.dot(wxr));
    std::cout << "v = " << v[0] << " " << v[1] << " " << v[2] << std::endl;

    VectorXd y(13);
    y << c[0],c[1],c[2],q.w(),q.x(),q.y(),q.z(),v[0],v[1],v[2],w[0],w[1],w[2];

    double h = 1e-3;
    for(double t=0.0;t<18.0;t+=h) {
        c = Vector3d(y[0],y[1],y[2]);
        q = Quaterniond(y[3],y[4],y[5],y[6]);
        v = Vector3d(y[7],y[8],y[9]);
        w = Vector3d(y[10],y[11],y[12]);
        R = q.toRotationMatrix();
        RT = R.transpose();
        B = R*B0*RT;
        B_1 = B.inverse();
        I = R*I0*RT;
        double E1 = 0.5*m*v.dot(v);
        double E2 = 0.5*w.transpose()*I*w;
        double E3 = m*g*(c[2]-1.0);
        VectorXd dy = dfdt(t,y);
        Vector3d dv(dy[7],dy[8],dy[9]);
        Vector3d dw(dy[10],dy[11],dy[12]);
//      double dE = m*v.dot(dv)+w.dot(I*dw)+m*g*e3.dot(v);
//      std::cout << dE << std::endl;

//      std::cout << sqrt(q.x()*q.x()+q.y()*q.y()+q.z()*q.z()+q.w()*q.w()) << std::endl;
//      std::cout << q.w() << " " << q.x() << " " << q.y() << " " << q.z() << std::endl;
//      Vector3d u = R.transpose()*w;
//      std::cout << u[0] << " " << u[1] << " " << u[2] << std::endl;
//      std::cout << R(0,2) << " " << R(1,2) << " " << R(2,2) << std::endl;
//      std::cout << w[0] << " " << w[1] << " " << w[2] << std::endl;
//      std::cout << q.w() << " " << q.x() << " " << q.y() << " " << q.z() << std::endl;
        Vector3d r = -B_1*e3/sqrt(e3.transpose()*B_1*e3);
//      std::cout << "r = " << r[0] << " " << r[1] << " " << r[2] << std::endl;
        Vector3d u = v + w.cross(r);
//      std::cout << u[0] << " " << u[1] << " " << u[2] << std::endl;
//      std::cout << c[0] << " " << c[1] << " " << c[2] << std::endl;
//      exit(0);
//      }
//      std::cout << y[0] << " " << y[1] << " " << y[2] << " " << y[3] << " " << y[4] << " " 
//                << y[5] << " " << y[6] << " " << y[7] << " " << y[8] << " " << y[9] << " " 
//                << y[10] << " " << y[11] << " " << y[12] << std::endl;
//      std::cout << E1+E2+E3 << " " << E1 << " " << E2 << " " << E3 << std::endl;
        std::cout << c[2] << " " << E1+E2+E3 << std::endl;
        y = rk4(t,h,y,dfdt);
    }
}

