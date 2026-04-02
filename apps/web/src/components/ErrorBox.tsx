export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      <p>Error: {message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-sm">
          Retry
        </button>
      )}
    </div>
  );
}
