
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, UserCheck, FileJson } from "lucide-react";

export function DetailedRevenue({ data }: any) {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${data.totalRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Combined recurring + one-time</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Recurring (MRR)</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${data.subscriptionRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{data.proCount} Pro, {data.premiumCount} Premium</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Export Revenue</CardTitle>
                        <FileJson className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${data.exportRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{data.exportCount} paid exports ($4/ea)</p>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Revenue Breakdown</CardTitle>
                    <CardDescription>
                        Analysis of revenue sources.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        {/* Chart could go here, for now simpler UI */}
                        <div className="w-full space-y-4">
                            <div className="flex items-center justify-between">
                                <span>Subscriptions</span>
                                <span className="font-medium">${data.subscriptionRevenue}</span>
                            </div>
                             <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-primary h-full" 
                                    style={{ width: `${(data.subscriptionRevenue / (data.totalRevenue || 1)) * 100}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <span>One-time Exports</span>
                                <span className="font-medium">${data.exportRevenue}</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-blue-500 h-full" 
                                    style={{ width: `${(data.exportRevenue / (data.totalRevenue || 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
