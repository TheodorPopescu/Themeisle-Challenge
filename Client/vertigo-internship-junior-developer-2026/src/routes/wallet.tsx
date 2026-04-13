import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { AppMenu } from '@/components/app-menu';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';

export const Route = createFileRoute('/wallet')({
    component: WalletPage,
});

function WalletPage() {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [balance, setBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [notice, setNotice] = useState<string | null>(null);
    const [isDepositBusy, setIsDepositBusy] = useState(false);

    const loadWalletSummary = async ({ background = false }: { background?: boolean } = {}) => {
        try {
            if (!background) {
                setIsLoading(true);
                setError(null);
            }

            const summary = await api.getWalletSummary();
            setBalance(summary.balance);
        } catch (loadError) {
            if (!background) {
                setError(loadError instanceof Error ? loadError.message : 'Failed to load wallet');
            }
        } finally {
            if (!background) {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        if (!isAuthenticated) {
            navigate({ to: '/auth/login' });
            return;
        }

        void loadWalletSummary();

        const refreshWallet = () => {
            if (document.visibilityState === 'hidden') {
                return;
            }

            void loadWalletSummary({ background: true });
        };

        window.addEventListener('focus', refreshWallet);
        document.addEventListener('visibilitychange', refreshWallet);

        return () => {
            window.removeEventListener('focus', refreshWallet);
            document.removeEventListener('visibilitychange', refreshWallet);
        };
    }, [isAuthenticated, navigate]);

    const handleDepositDemo = async () => {
        if (user?.role !== 'ADMIN') {
            setNotice('Only available to admins');
            return;
        }

        const amount = Number(depositAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setNotice('Enter a valid amount');
            return;
        }

        try {
            setIsDepositBusy(true);
            setNotice(null);
            const response = await api.depositWalletBalance(amount);
            setBalance(response.balance);
            setDepositAmount('');
            setNotice('Balance added');
        } catch (depositError) {
            setNotice(depositError instanceof Error ? depositError.message : 'Failed to add balance');
        } finally {
            setIsDepositBusy(false);
        }
    };

    const handleWithdrawDemo = () => {
        setNotice('Demo only: withdrawals are not processed.');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 dark:from-gray-900 dark:to-gray-800">
            <div className="mx-auto max-w-4xl space-y-8 px-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Wallet</h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">View your current balance and manage wallet actions.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => void loadWalletSummary()} disabled={isLoading}>
                            {isLoading ? 'Refreshing...' : 'Refresh'}
                        </Button>
                        <Button variant="outline" onClick={() => navigate({ to: '/profile' })}>
                            ← Back to Profile
                        </Button>
                        <ThemeToggle />
                        <AppMenu />
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Current Balance</CardTitle>
                        <CardDescription>Your available in-app funds.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error ? (
                            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
                        ) : (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/70 dark:bg-emerald-950/40">
                                <p className="text-sm font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Available</p>
                                <p className="mt-2 text-4xl font-bold text-emerald-700 dark:text-emerald-200">
                                    {isLoading && balance === null ? 'Loading...' : `$${(balance ?? 0).toFixed(2)}`}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Add Balance</CardTitle>
                            <CardDescription>
                                {user?.role === 'ADMIN'
                                    ? 'Admin tool: add funds directly to this account.'
                                    : 'Restricted action.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="depositAmount">Amount</Label>
                                <Input
                                    id="depositAmount"
                                    className="wallet-amount-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={depositAmount}
                                    onChange={(event) => {
                                        setDepositAmount(event.target.value);
                                        setNotice(null);
                                    }}
                                    placeholder="Enter amount"
                                />
                            </div>
                            <Button className="w-full" onClick={() => void handleDepositDemo()} disabled={!depositAmount || isDepositBusy}>
                                {isDepositBusy ? 'Adding...' : 'Add Balance'}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Withdraw Balance</CardTitle>
                            <CardDescription>Demo only.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="withdrawAmount">Amount</Label>
                                <Input
                                    id="withdrawAmount"
                                    className="wallet-amount-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={withdrawAmount}
                                    onChange={(event) => {
                                        setWithdrawAmount(event.target.value);
                                        setNotice(null);
                                    }}
                                    placeholder="Enter amount"
                                />
                            </div>
                            <Button className="w-full" variant="outline" onClick={handleWithdrawDemo} disabled={!withdrawAmount}>
                                Withdraw
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {notice && (
                    <Card>
                        <CardContent className="py-4">
                            <p className="text-sm text-slate-600 dark:text-slate-300">{notice}</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}