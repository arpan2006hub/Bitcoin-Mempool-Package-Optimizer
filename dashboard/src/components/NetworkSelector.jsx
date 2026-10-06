import React, { useState } from 'react';
import { ChevronDown, Globe, ShieldAlert, Cpu } from 'lucide-react';

export default function NetworkSelector({ selectedNetwork, onSelectNetwork }) {
  const [isOpen, setIsOpen] = useState(false);

  const networks = [
    {
      id: 'regtest',
      name: 'Regtest',
      tag: 'Active',
      description: 'Controlled synthetic experiments',
      icon: Cpu,
      color: 'bg-emerald-500',
    },
    {
      id: 'testnet4',
      name: 'Testnet4',
      tag: 'Observation Mode',
      description: 'Real-world mempool observation',
      icon: Globe,
      color: 'bg-amber-500',
    },
  ];

  const current = networks.find((n) => n.id === selectedNetwork) || networks[0];

  const handleSelect = (netId) => {
    onSelectNetwork(netId);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Select Bitcoin network"
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#f7931a]"
      >
        <span className={`w-2 h-2 rounded-full ${current.color}`} aria-hidden="true" />
        <span className="font-semibold">{current.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-xl bg-white p-2 shadow-lg border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Select Network
          </div>
          <div className="space-y-1 mt-1">
            {networks.map((net) => {
              const Icon = net.icon;
              const isSelected = net.id === selectedNetwork;
              return (
                <button
                  key={net.id}
                  role="menuitem"
                  type="button"
                  onClick={() => handleSelect(net.id)}
                  className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors ${
                    isSelected ? 'bg-orange-50 border border-orange-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-1.5 rounded-md ${isSelected ? 'bg-[#f7931a] text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-orange-950' : 'text-slate-900'}`}>
                        {net.name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isSelected ? 'bg-orange-200 text-orange-900' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {net.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {net.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedNetwork === 'testnet4' && (
            <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 leading-tight">
                No active Testnet4 daemon connected. Observing saved synthetic snapshot data.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
