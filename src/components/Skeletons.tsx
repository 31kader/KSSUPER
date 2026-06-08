import React from 'react';
import { Card } from './ui';
import { Skeleton } from './ui/Skeleton';

export function StatCardSkeleton() {
  return (
    <Card className="p-4 sm:p-6 flex items-center gap-4 sm:gap-6">
      <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl shrink-0" />
      <div className="min-w-0 space-y-2 flex-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </Card>

        <Card className="p-6 space-y-6">
          <Skeleton className="h-6 w-48" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-3 w-12 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function InventorySkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full md:max-w-md">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="p-0">
          <div className="flex flex-col">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0">
                <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20 hidden md:block" />
                <Skeleton className="h-4 w-20 hidden md:block" />
                <Skeleton className="h-8 w-32 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function CheckoutSkeleton() {
    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 mt-20 sm:mt-0">
                <div className="lg:col-span-3 space-y-6">
                    <div className="flex gap-4">
                        <Skeleton className="h-12 flex-1 rounded-xl" />
                        <Skeleton className="h-12 w-12 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                        {[...Array(10)].map((_, i) => (
                            <Card key={i} className="p-4 space-y-3">
                                <Skeleton className="aspect-square w-full rounded-lg" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-5 w-1/2" />
                            </Card>
                        ))}
                    </div>
                </div>
                <div className="space-y-6">
                     <Card className="p-6 space-y-6 flex flex-col h-full">
                        <Skeleton className="h-8 w-full" />
                        <div className="flex-1 space-y-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex justify-between items-center">
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                    <Skeleton className="h-6 w-12" />
                                </div>
                            ))}
                        </div>
                        <div className="border-t pt-6 space-y-4">
                            <div className="flex justify-between">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-20" />
                            </div>
                            <div className="flex justify-between">
                                <Skeleton className="h-6 w-20" />
                                <Skeleton className="h-8 w-32" />
                            </div>
                            <Skeleton className="h-14 w-full rounded-2xl" />
                        </div>
                     </Card>
                </div>
            </div>
        </div>
    )
}
