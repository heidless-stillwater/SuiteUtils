import { Check, Zap, Crown, Building2 } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/forever',
    icon: <Zap className="w-6 h-6" />,
    accent: 'primary',
    features: ['1 Suite', '3 Apps per Suite', 'Manual Deploys', 'Basic History', 'Default Theme'],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    icon: <Crown className="w-6 h-6" />,
    accent: 'accent',
    highlight: true,
    features: ['Unlimited Suites', 'Unlimited Apps', 'Batch Deploys', 'Expert System Analytics', 'Custom Themes', 'Rollback Support', 'Priority Support'],
    cta: 'Upgrade to Pro',
    disabled: false,
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: '/month',
    icon: <Building2 className="w-6 h-6" />,
    accent: 'info',
    features: ['Everything in Pro', 'Team Members', 'Audit Logs', 'Custom Domains', 'SLA Guarantee', 'Dedicated Support', 'API Access', 'White-label'],
    cta: 'Contact Sales',
    disabled: false,
  },
];

export function PricingPage() {
  return (
    <div className="page-enter space-y-8">
      <div className="text-center max-w-xl mx-auto">
        <h1 className="text-3xl font-bold text-white/90 mb-2">Choose Your Plan</h1>
        <p className="text-white/40">Scale your operations with the power of SuiteUtils.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`glass-card p-6 relative flex flex-col ${
              plan.highlight ? 'border-primary/30 shadow-[0_0_40px_rgba(13,148,136,0.1)]' : ''
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="badge badge-accent">Most Popular</span>
              </div>
            )}

            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              plan.accent === 'primary' ? 'bg-primary/10 text-primary' :
              plan.accent === 'accent' ? 'bg-accent/10 text-accent' :
              'bg-cyan-500/10 text-cyan-400'
            }`}>{plan.icon}</div>

            <h3 className="text-lg font-bold text-white/90">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mt-2 mb-6">
              <span className="text-3xl font-black text-white/90">{plan.price}</span>
              <span className="text-sm text-white/30">{plan.period}</span>
            </div>

            <ul className="space-y-3 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white/60">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />{f}
                </li>
              ))}
            </ul>

            <button
              disabled={plan.disabled}
              className={plan.highlight ? 'btn-primary w-full' : 'btn-secondary w-full'}
            >{plan.cta}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
