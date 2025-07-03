'use client'; // This MUST be the very first line!

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'; // <--- Import Suspense
import { useSearchParams, usePathname } from 'next/navigation';

const TIER_STAMINA_COSTS = [0.75, 0.89, 1.03, 1.16, 1.28, 1.41, 1.52, 1.64, 1.75, 1.86];

// It's good practice to wrap the component that USES useSearchParams
// inside a Suspense boundary if the parent component is a server component.
// However, since app/page.tsx is a client component, we'll wrap its content.

// Let's create a dedicated component for the main logic that uses searchParams.
// This helps isolate the client-side logic.
function PageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // State definitions and logic remain the same as your latest version.
  // ... (All your useState, useEffect, useCallback, handlers go here)
  // For brevity, I'm omitting the full content, but assume everything
  // from your existing HomePage function (except the return wrapper)
  // moves into this PageContent function.

  const [initialStamina, setInitialStamina] = useState<number>(parseFloat(searchParams.get('s') || '100'));
  const [displayInitialStamina, setDisplayInitialStamina] = useState<string>(searchParams.get('s') || '100');

  const [tier, setTier] = useState(searchParams.get('t') || 'T1');

  const [requiredWorkload, setRequiredWorkload] = useState<number>(parseFloat(searchParams.get('w') || '1000'));
  const [displayRequiredWorkload, setDisplayRequiredWorkload] = useState<string>(searchParams.get('w') || '1000');

  const [staminaRecovery, setStaminaRecovery] = useState<number>(parseFloat(searchParams.get('r') || '10'));
  const [displayStaminaRecovery, setDisplayStaminaRecovery] = useState<string>(searchParams.get('r') || '10');

  const [cycleTime, setCycleTime] = useState<number>(parseFloat(searchParams.get('c') || '5')); // seconds
  const [displayCycleTime, setDisplayCycleTime] = useState<string>(searchParams.get('c') || '5');

  const [toolPower, setToolPower] = useState<number>(parseFloat(searchParams.get('p') || '10'));
  const [displayToolPower, setDisplayToolPower] = useState<string>(searchParams.get('p') || '10');


  const [totalWorkTime, setTotalWorkTime] = useState(0); // in seconds

  const [staminaDepletionTime, setStaminaDepletionTime] = useState<number | null>(null);
  const [staminaCountdown, setStaminaCountdown] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [urlShare, setUrlShare] = useState('');

  // URLパラメータからの初期化
  useEffect(() => {
    const s = searchParams.get('s') || '100';
    const w = searchParams.get('w') || '1000';
    const r = searchParams.get('r') || '10';
    const c = searchParams.get('c') || '5';
    const p = searchParams.get('p') || '10';

    setInitialStamina(parseFloat(s));
    setDisplayInitialStamina(s);
    setTier(searchParams.get('t') || 'T1');
    setRequiredWorkload(parseFloat(w));
    setDisplayRequiredWorkload(w);
    setStaminaRecovery(parseFloat(r));
    setDisplayStaminaRecovery(r);
    setCycleTime(parseFloat(c));
    setDisplayCycleTime(c);
    setToolPower(parseFloat(p));
    setDisplayToolPower(p);
  }, [searchParams]);

  // パラメータ変更時のURL更新
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('s', initialStamina.toString());
    params.set('t', tier);
    params.set('w', requiredWorkload.toString());
    params.set('r', staminaRecovery.toString());
    params.set('c', cycleTime.toString());
    params.set('p', toolPower.toString());
    setUrlShare(`${window.location.origin}${pathname}?${params.toString()}`);
  }, [initialStamina, tier, requiredWorkload, staminaRecovery, cycleTime, toolPower, pathname]);

  // 作業時間の計算ロジック
  const calculateWorkTime = useCallback(() => {
    const currentInitialStamina = isNaN(initialStamina) || initialStamina <= 0 ? 100 : initialStamina;
    const currentRequiredWorkload = isNaN(requiredWorkload) || requiredWorkload <= 0 ? 1000 : requiredWorkload;
    const currentStaminaRecovery = isNaN(staminaRecovery) || staminaRecovery <= 0 ? 10 : staminaRecovery;
    const currentCycleTime = isNaN(cycleTime) || cycleTime <= 0 ? 5 : cycleTime;
    const currentToolPower = isNaN(toolPower) || toolPower <= 0 ? 10 : toolPower;

    let currentWorkload = currentRequiredWorkload;
    let currentStamina = currentInitialStamina;
    let timeElapsed = 0;
    let staminaDepleteAt = 0;

    const tierIndex = parseInt(tier.replace('T', '')) - 1;
    const staminaCostPerWork = TIER_STAMINA_COSTS[tierIndex];

    if (isNaN(staminaCostPerWork) || currentToolPower <= 0 || currentCycleTime <= 0 || currentStaminaRecovery <= 0) {
      setTotalWorkTime(0);
      setStaminaDepletionTime(null);
      setStaminaCountdown(null);
      setIsTimerRunning(false);
      return;
    }

    let staminaDepletedThisRun = false;

    while (currentWorkload > 0) {
      if (currentStamina >= staminaCostPerWork) {
        currentStamina -= staminaCostPerWork;
        currentWorkload -= currentToolPower;
        timeElapsed += currentCycleTime;

        if (!staminaDepletedThisRun) {
          const estimatedRemainingWorkCycles = currentStamina / staminaCostPerWork;
          if (estimatedRemainingWorkCycles * currentCycleTime < 0.1) {
             staminaDepleteAt = timeElapsed;
             staminaDepletedThisRun = true;
          }
        }
      } else {
        if (!staminaDepletedThisRun) {
           staminaDepleteAt = timeElapsed;
           staminaDepletedThisRun = true;
        }
        const staminaNeeded = staminaCostPerWork - currentStamina;
        const restTimeNeeded = (staminaNeeded / currentStaminaRecovery) * currentCycleTime;
        currentStamina += currentStaminaRecovery;
        timeElapsed += restTimeNeeded;
      }
    }
    setTotalWorkTime(timeElapsed);
    setStaminaDepletionTime(staminaDepleteAt);
    setStaminaCountdown(staminaDepleteAt);
  }, [initialStamina, tier, requiredWorkload, staminaRecovery, cycleTime, toolPower]);

  // 目標時間からの作業量逆算ロジック
  const calculateWorkloadFromTime = useCallback((targetMinutes: number) => {
    const currentInitialStamina = isNaN(initialStamina) || initialStamina <= 0 ? 100 : initialStamina;
    const currentStaminaRecovery = isNaN(staminaRecovery) || staminaRecovery <= 0 ? 10 : staminaRecovery;
    const currentCycleTime = isNaN(cycleTime) || cycleTime <= 0 ? 5 : cycleTime;
    const currentToolPower = isNaN(toolPower) || toolPower <= 0 ? 10 : toolPower;

    const targetSeconds = targetMinutes * 60;
    let estimatedWorkload = 0;
    let currentStamina = currentInitialStamina;
    let timeElapsed = 0;

    const tierIndex = parseInt(tier.replace('T', '')) - 1;
    const staminaCostPerWork = TIER_STAMINA_COSTS[tierIndex];

    if (isNaN(staminaCostPerWork) || currentToolPower <= 0 || currentCycleTime <= 0 || currentStaminaRecovery <= 0) {
      setRequiredWorkload(0);
      setDisplayRequiredWorkload('0');
      return;
    }

    while (timeElapsed < targetSeconds) {
      if (currentStamina >= staminaCostPerWork) {
        currentStamina -= staminaCostPerWork;
        estimatedWorkload += currentToolPower;
        timeElapsed += currentCycleTime;
      } else {
        const staminaNeeded = staminaCostPerWork - currentStamina;
        const restTimeNeeded = (staminaNeeded / currentStaminaRecovery) * currentCycleTime;
        currentStamina += currentStaminaRecovery;
        timeElapsed += restTimeNeeded;
      }
    }
    const roundedWorkload = Math.round(estimatedWorkload);
    setRequiredWorkload(roundedWorkload);
    setDisplayRequiredWorkload(roundedWorkload.toString());
  }, [initialStamina, tier, staminaRecovery, cycleTime, toolPower]);

  // パラメータ変更時に作業時間を再計算
  useEffect(() => {
    calculateWorkTime();
  }, [initialStamina, tier, requiredWorkload, staminaRecovery, cycleTime, toolPower, calculateWorkTime]);

  // スタミナタイマーのロジック
  useEffect(() => {
    if (isTimerRunning && staminaCountdown !== null && staminaCountdown > 0) {
      timerIntervalRef.current = setInterval(() => {
        setStaminaCountdown((prev) => (prev !== null ? parseFloat((prev - 0.1).toFixed(1)) : null));
      }, 100);
    } else if (staminaCountdown !== null && staminaCountdown <= 0) {
      setIsTimerRunning(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setStaminaCountdown(0);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning, staminaCountdown]);

  const handleStartStopTimer = () => {
    if (staminaCountdown !== null && staminaCountdown <= 0 && !isTimerRunning) {
        setStaminaCountdown(staminaDepletionTime);
    }
    setIsTimerRunning((prev) => !prev);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setStaminaCountdown(staminaDepletionTime);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    const integerSeconds = Math.floor(remainingSeconds);
    const decimalSeconds = Math.floor((remainingSeconds - integerSeconds) * 10);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${integerSeconds.toString().padStart(2, '0')}.${decimalSeconds}`;
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(urlShare);
    alert('URL copied to clipboard!');
  };

  const handleNumericInputAndDisplayChange = (
    valueSetter: React.Dispatch<React.SetStateAction<number>>,
    displaySetter: React.Dispatch<React.SetStateAction<string>>,
    defaultValue: number
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    displaySetter(inputValue);

    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      valueSetter(numValue);
    } else if (inputValue === '') {
      valueSetter(NaN);
    } else if (inputValue === '.' || inputValue === '0.') {
        valueSetter(NaN);
    } else {
      valueSetter(defaultValue);
    }
  };


  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
      <h1 className="text-5xl font-extrabold mb-10 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        Workload Calculator & Timer
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        {/* Input Parameters */}
        <div className="bg-gray-800 p-8 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
          <h2 className="text-3xl font-bold mb-6 text-purple-300">Parameters</h2>
          <div className="space-y-6">
            <div>
              <label htmlFor="initialStamina" className="block text-lg font-medium text-gray-300 mb-2">
                Initial Stamina (S)
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="initialStamina"
                value={displayInitialStamina}
                onChange={handleNumericInputAndDisplayChange(setInitialStamina, setDisplayInitialStamina, 100)}
                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:ring-purple-500 focus:border-purple-500 appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
              />
            </div>

            <div>
              <label className="block text-lg font-medium text-gray-300 mb-2">Tier (T)</label>
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: 10 }, (_, i) => `T${i + 1}`).map((t) => (
                  <label key={t} className="inline-flex items-center">
                    <input
                      type="radio"
                      name="tier"
                      value={t}
                      checked={tier === t}
                      onChange={(e) => setTier(e.target.value)}
                      className="form-radio text-purple-500 h-5 w-5"
                    />
                    <span className="ml-2 text-gray-300">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="requiredWorkload" className="block text-lg font-medium text-gray-300 mb-2">
                Required Workload (W)
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="requiredWorkload"
                value={displayRequiredWorkload}
                onChange={handleNumericInputAndDisplayChange(setRequiredWorkload, setDisplayRequiredWorkload, 1000)}
                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:ring-purple-500 focus:border-purple-500 appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
              />
            </div>

            <div>
              <label htmlFor="staminaRecovery" className="block text-lg font-medium text-gray-300 mb-2">
                Stamina Recovery (R)
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="staminaRecovery"
                value={displayStaminaRecovery}
                onChange={handleNumericInputAndDisplayChange(setStaminaRecovery, setDisplayStaminaRecovery, 10)}
                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:ring-purple-500 focus:border-purple-500 appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
              />
            </div>

            <div>
              <label htmlFor="cycleTime" className="block text-lg font-medium text-gray-300 mb-2">
                Cycle Time (C) <span className="text-gray-400 text-sm">(seconds)</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="cycleTime"
                value={displayCycleTime}
                onChange={handleNumericInputAndDisplayChange(setCycleTime, setDisplayCycleTime, 5)}
                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:ring-purple-500 focus:border-purple-500 appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
              />
            </div>

            <div>
              <label htmlFor="toolPower" className="block text-lg font-medium text-gray-300 mb-2">
                Tool Power (P)
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="toolPower"
                value={displayToolPower}
                onChange={handleNumericInputAndDisplayChange(setToolPower, setDisplayToolPower, 10)}
                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:ring-purple-500 focus:border-purple-500 appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
              />
            </div>
          </div>
        </div>

        {/* Results and Timer */}
        <div className="bg-gray-800 p-8 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300 flex flex-col justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-6 text-pink-300">Results</h2>
            <div className="mb-6">
              <p className="text-lg text-gray-300 mb-2">Total Work Time:</p>
              <p className="text-5xl font-extrabold text-green-400">
                {formatTime(totalWorkTime)}
              </p>
            </div>

            <div className="mb-6">
              <p className="text-lg text-gray-300 mb-2">Stamina Depletion Timer:</p>
              <p className={`text-5xl font-extrabold ${staminaCountdown !== null && staminaCountdown <= 10 && staminaCountdown > 0 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                {staminaCountdown !== null ? formatTime(staminaCountdown) : 'N/A'}
              </p>
              <div className="flex gap-4 mt-4">
                <button
                  onClick={handleStartStopTimer}
                  disabled={staminaDepletionTime === null}
                  className={`flex-1 ${isTimerRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isTimerRunning ? 'Stop Timer' : 'Start Timer'}
                </button>
                <button
                  onClick={handleResetTimer}
                  disabled={staminaDepletionTime === null && staminaCountdown === null}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset Timer
                </button>
              </div>
            </div>

            <h3 className="text-2xl font-bold mb-4 text-pink-300">Reverse Calculate Workload</h3>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => calculateWorkloadFromTime(30)}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors duration-300"
              >
                30 Minutes
              </button>
              <button
                onClick={() => calculateWorkloadFromTime(60)}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors duration-300"
              >
                60 Minutes
              </button>
            </div>
          </div>

          {/* URL Share */}
          <div>
            <h3 className="text-2xl font-bold mb-4 text-purple-300">Share Current Settings</h3>
            <div className="flex items-center space-x-3">
              <input
                type="text"
                readOnly
                value={urlShare}
                className="flex-grow p-3 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 text-sm"
              />
              <button
                onClick={handleCopyToClipboard}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-5 rounded-lg transition-colors duration-300"
              >
                Copy URL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// Original HomePage component
export default function HomePage() {
  return (
    // Wrap the entire client-side content with Suspense
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center text-3xl">
        Loading calculator...
      </div>
    }>
      <PageContent />
    </Suspense>
  );
}
