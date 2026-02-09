import { fetchNetWorth, fetchHistory } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, CreditCard, Wallet, TrendingUp, ArrowDownRight } from "lucide-react";
import { NetWorthChart } from "@/components/dashboard/net-worth-chart";
import { CurrencyDisplay } from "@/components/currency-display";
import { DashboardInsightsCard } from "@/components/dashboard/dashboard-insights";
import { FinancialStoriesCard } from "@/components/dashboard/financial-stories";

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Your financial overview at a glance</p>
        </div>
      </div>

      {/* Top Metrics - with staggered animation */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Net Worth Card - Hero Card with gradient border */}
        <Card className="relative overflow-hidden opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.1s_forwards]">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-success/5" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
              <DollarSign className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold tabular-nums tracking-tight">
              <CurrencyDisplay value={netWorth} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total wealth across all accounts
            </p>
          </CardContent>
        </Card>

        {/* Assets Card */}
        <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.2s_forwards]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
              <Wallet className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-gain">
              <CurrencyDisplay value={assets} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {assetList.length} active account{assetList.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        {/* Liabilities Card */}
        <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.3s_forwards]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
              <CreditCard className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-loss">
              <CurrencyDisplay value={liabilities} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {liabilityList.length} outstanding debt{liabilityList.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

        {/* Chart Column (4/7 width) */}
        <div className="col-span-4 opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.4s_forwards]">
          <NetWorthChart data={history} />
        </div>

        {/* Breakdown Column (3/7 width) */}
        <Card className="col-span-4 lg:col-span-3 opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.5s_forwards]">
          <CardHeader>
            <CardTitle>Top Assets</CardTitle>
            <CardDescription>
              Your largest holdings by value
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assetList.slice(0, 5).map((asset: any, i: number) => (
                <div key={i} className="flex items-center group">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 transition-colors group-hover:bg-success/20">
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                  <div className="ml-4 space-y-0.5 flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.currency}</p>
                  </div>
                  <div className="ml-auto font-semibold tabular-nums text-gain">
                    <CurrencyDisplay value={asset.balance} showSign />
                  </div>
                </div>
              ))}
              {assetList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Wallet className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No assets found</p>
                  <p className="text-xs text-muted-foreground mt-1">Add your first asset to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Row */}
      <div className="grid gap-4 md:grid-cols-2 opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.6s_forwards]">
        <DashboardInsightsCard />
        <FinancialStoriesCard />
      </div>
    </div>
  );
}
