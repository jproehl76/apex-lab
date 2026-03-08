import { useGoogleOneTapLogin, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import apexLabLogo from '@/assets/jp-apex-lab-logo.png';

interface GoogleJwt {
  email: string;
  name: string;
  picture: string;
}

interface LoginScreenProps {
  onAuth: (user: { email: string; name: string; picture: string }) => void;
}

function handleCredential(credential: string, onAuth: LoginScreenProps['onAuth']) {
  const decoded = jwtDecode<GoogleJwt>(credential);
  onAuth({ email: decoded.email, name: decoded.name, picture: decoded.picture });
}

export function LoginScreen({ onAuth }: LoginScreenProps) {
  useGoogleOneTapLogin({
    onSuccess: (response) => {
      if (response.credential) handleCredential(response.credential, onAuth);
    },
    onError: () => {},
  });

  return (
    <div
      className="h-screen flex flex-col items-center justify-center text-slate-100"
      style={{
        background: 'linear-gradient(145deg, #050510 0%, #0a0a1a 30%, #0c1a38 60%, #080818 100%)',
      }}
    >
      {/* Subtle grid texture */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(28,105,212,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(28,105,212,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        <img
          src={apexLabLogo}
          alt="JP Apex Lab"
          style={{ height: 160, width: 'auto' }}
        />
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-8 flex flex-col items-center gap-4 w-full max-w-sm">
          <p className="text-sm text-slate-400">Sign in to access your data</p>
          <GoogleLogin
            onSuccess={(response) => {
              if (response.credential) handleCredential(response.credential, onAuth);
            }}
            onError={() => {}}
            theme="filled_black"
            shape="rectangular"
            size="large"
            useOneTap={false}
          />
        </div>
      </div>
    </div>
  );
}
