'use client';

import React from 'react';
import { useSovereignStatus } from '@/hooks/useSovereignStatus';
import { SovereignLock } from './SovereignLock';
import { SovereignAlert } from './SovereignAlert';

/**
 * The Sovereign Sentinel is a root-level compliance enforcer.
 * It monitors the global protection status and anchors the physical
 * Sovereign Lock when compliance is breached.
 */
export function SovereignSentinel() {
  const { gated, status, message, breachedPolicySlug } = useSovereignStatus();

  // 1. Sovereign Gating (Suite-wide lock) takes precedence
  if (gated && status === 'red') {
    return <SovereignLock message={message} breachedPolicySlug={breachedPolicySlug} />;
  }

  return (
    <>
      {/* 2. Advisory Alerts (Non-blocking) */}
      {status === 'amber' && message && (
        <SovereignAlert message={message} policySlug={breachedPolicySlug} />
      )}
    </>
  );
}
