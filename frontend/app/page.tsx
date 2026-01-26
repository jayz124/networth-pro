import { fetchNetWorth, fetchHistory } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, CreditCard, Wallet, TrendingUp, ArrowDownRight } from "lucide-react";
import { NetWorthChart } from "@/components/dashboard/net-worth-chart";
import { AllocationChart } from "@/components/dashboard/allocation-chart";

export default async function Home() {
  // Parallel data fetching
  const [data, history] = await Promise.all([
    fetchNetWorth(),
    fetchHistory()
  ]);

  // Fallback defaults
  const netWorth = data?.net_worth ?? 0;
  const assets = data?.total_assets ?? 0;
  const liabilities = data?.total_liabilities ?? 0;

  const assetList = data?.assets || [];
  const liabilityList = data?.liabilities || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>

      {/* Top Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${netWorth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total wealth across all accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${assets.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {assetList.length} active accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${liabilities.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {liabilityList.length} outstanding debts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

        {/* Chart Column (4/7 width) */}
        <NetWorthChart data={history} />

        {/* Breakdown Column (3/7 width) */}
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle>Top Assets</CardTitle>
            <CardDescription>
              Your largest holdings by value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assetList.slice(0, 5).map((asset: any, i: number) => (
                <div key={i} className="flex items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.currency}</p>
                  </div>
                  <div className="ml-auto font-medium">+${asset.balance.toLocaleString()}</div>
                </div>
              ))}
              {assetList.length === 0 && (
                <p className="text-sm text-muted-foreground">No assets found to display.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
