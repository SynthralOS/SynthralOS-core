import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function InvitationAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = searchParams.get('token');
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setLoading(false);
      return;
    }

    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      const response = await api.get(`/invitations/token/${token}`);
      setInvitation(response.data);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Invalid or expired invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login if not authenticated
      navigate(`/login?redirect=/invitations/accept?token=${token}`);
      return;
    }

    setAccepting(true);
    try {
      await api.post('/invitations/accept', { token });
      alert('Invitation accepted successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Error accepting invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading invitation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Invitation</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">You've Been Invited!</h1>
        <p className="text-gray-600 mb-6">
          You have been invited to join an organization on the SynthralOS Automation Platform.
        </p>

        {invitation && (
          <div className="mb-6">
            <div className="bg-gray-50 rounded-md p-4">
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {invitation.email}
              </p>
              {invitation.teamId && (
                <p className="text-sm text-gray-600 mt-2">
                  <strong>Team:</strong> {invitation.teamId}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-2">
                <strong>Expires:</strong> {new Date(invitation.expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {!user ? (
          <div>
            <p className="text-gray-600 mb-4">
              Please log in to accept this invitation.
            </p>
            <button
              onClick={() => navigate(`/login?redirect=/invitations/accept?token=${token}`)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Log In
            </button>
          </div>
        ) : (
          <div>
            {user.email !== invitation?.email && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  Warning: Your email ({user.email}) does not match the invitation email (
                  {invitation?.email}). You may not be able to accept this invitation.
                </p>
              </div>
            )}
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {accepting ? 'Accepting...' : 'Accept Invitation'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


