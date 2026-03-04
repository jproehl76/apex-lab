import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import bmwMLogo from '@/assets/bmw-m-logo.jpg';
import trackPhoto from '@/assets/m3-track.jpg';

const ALLOWED_EMAIL = 'jonathan.proehl@gmail.com';

interface GoogleJwt {
  email: string;
  name: string;
  picture: string;
}

interface LoginScreenProps {
  onAuth: (user: { email: string; name: string; picture: string }) => void;
}

export function LoginScreen({ onAuth }: LoginScreenProps) {
  return (
    <div className="relative h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
      <img
        src={trackPhoto}
        alt=""
        aria-hidden="true"
        className="fixed inset-0 w-full h-full object-cover pointer-events-none"
        style={{ objectPosition: 'center 40%', filter: 'brightness(0.55) saturate(0.8)', opacity: 0.50, zIndex: 0 }}
      />
      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        <img
          src={bmwMLogo}
          alt="BMW M"
          className="h-32 w-32"
          style={{ mixBlendMode: 'screen' }}
        />
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">M3 Session Dashboard</h1>
          <p className="text-slate-400 mt-1 text-sm">2025 BMW G80 M3 Competition xDrive</p>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-8 flex flex-col items-center gap-4 w-full max-w-sm">
          <p className="text-sm text-slate-400">Sign in to access your data</p>
          <GoogleLogin
            onSuccess={(response) => {
              if (!response.credential) return;
              const decoded = jwtDecode<GoogleJwt>(response.credential);
              if (decoded.email !== ALLOWED_EMAIL) {
                alert('Access denied.');
                return;
              }
              onAuth({ email: decoded.email, name: decoded.name, picture: decoded.picture });
            }}
            onError={() => console.error('Google sign-in failed')}
            theme="filled_black"
            shape="rectangular"
            size="large"
          />
        </div>
      </div>
    </div>
  );
}
