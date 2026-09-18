import React from "react";

export function AppleWalletBadge({ onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`w-full sm:w-auto flex justify-center items-center p-0 bg-transparent border-0 hover:opacity-90 active:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-xl ${className}`}
      aria-label="Adicionar à Carteira da Apple"
      type="button"
    >
      <img
        src="/apple-wallet-badge.svg"
        alt="Adicionar à Carteira da Apple"
        className="h-12 sm:h-12 w-auto object-contain"
        loading="lazy"
        draggable={false}
      />
    </button>
  );
}

export function GoogleWalletBadge({ onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`w-full sm:w-auto flex justify-center items-center p-0 bg-transparent border-0 hover:opacity-90 active:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-xl ${className}`}
      aria-label="Add to Google Wallet"
      type="button"
    >
      <img
        src="/google-wallet-badge.svg"
        alt="Add to Google Wallet"
        className="h-12 sm:h-12 w-auto object-contain"
        loading="lazy"
        draggable={false}
      />
    </button>
  );
}
