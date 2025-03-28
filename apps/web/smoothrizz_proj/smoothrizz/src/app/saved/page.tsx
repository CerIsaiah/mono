import { useState, FC } from 'react';

interface SavedResponse {
  id: string;
  // Add other properties as needed
}

interface SubscriptionDetails {
  isTrialActive: boolean;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
}

export default function SavedResponses() {
  const [activeTab, setActiveTab] = useState<'saved' | 'profile'>('saved');
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [showConfirmCancelModal, setShowConfirmCancelModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);

  const handleCredentialResponse = (response: any) => {
    // Handle Google Sign-In response
    console.log('Google Sign-In response:', response);
  };

  const handleSignOut = () => {
    const googleAccountsId = (window as any).google?.accounts?.id;
    if (googleAccountsId) {
      googleAccountsId.disableAutoSelect();
    }
  };

  const initializeGoogleSignIn = () => {
    const googleAccountsId = (window as any).google?.accounts?.id;
    const signInButtonContainer = document.getElementById('googleSignInButtonContainer');

    if (signInButtonContainer && googleAccountsId) {
      googleAccountsId.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        callback: handleCredentialResponse,
        auto_select: false
      });

      if (signInButtonContainer) {
        googleAccountsId.renderButton(
          signInButtonContainer,
          { theme: 'outline', size: 'large' }
        );
      }
    }
  };

  const confirmCancellation = async () => {
    // Add your cancellation logic here
    console.log('Confirming cancellation...');
  };

  interface ConfirmCancelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    subscriptionDetails: SubscriptionDetails | null;
  }

  interface CancelResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    success: boolean;
    subscriptionDetails: SubscriptionDetails | null;
  }

  const ConfirmCancelModal: FC<ConfirmCancelModalProps> = ({ isOpen, onClose, onConfirm, subscriptionDetails }) => {
    if (!isOpen) return null;

    const isTrialActive = subscriptionDetails?.isTrialActive ?? false;
    const endDate = isTrialActive ? subscriptionDetails?.trialEndsAt : subscriptionDetails?.subscriptionEndsAt;
    const endDateFormatted = endDate ? new Date(endDate).toLocaleDateString() : 'the end of the period';

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>Confirm Cancellation</h2>
          <p>Are you sure you want to cancel your subscription?</p>
          <p>Your access will continue until {endDateFormatted}.</p>
          <div className="modal-actions">
            <button onClick={onClose}>Keep Subscription</button>
            <button onClick={onConfirm}>Confirm Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  const CancelResultModal: FC<CancelResultModalProps> = ({ isOpen, onClose, success, subscriptionDetails }) => {
    if (!isOpen) return null;

    const isTrialActive = subscriptionDetails?.isTrialActive ?? false;
    const endDate = isTrialActive ? subscriptionDetails?.trialEndsAt : subscriptionDetails?.subscriptionEndsAt;
    const endDateFormatted = endDate ? new Date(endDate).toLocaleDateString() : 'the end of the period';

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>{success ? 'Cancellation Successful' : 'Cancellation Failed'}</h2>
          {success ? (
            <p>Your subscription has been cancelled. You will have access until {endDateFormatted}.</p>
          ) : (
            <p>There was an error cancelling your subscription. Please try again or contact support.</p>
          )}
          <div className="modal-actions">
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <ConfirmCancelModal
        isOpen={showConfirmCancelModal}
        onClose={() => setShowConfirmCancelModal(false)}
        onConfirm={confirmCancellation}
        subscriptionDetails={subscriptionDetails}
      />

      <CancelResultModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        success={cancelSuccess}
        subscriptionDetails={subscriptionDetails}
      />
    </div>
  );
}