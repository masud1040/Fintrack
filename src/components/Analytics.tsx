import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatCurrency, cn, savePDF } from '../lib/utils';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area, Sector
} from 'recharts';
import { startOfMonth, endOfMonth, isWithinInterval, format, addMonths, subMonths, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, ArrowDownRight, ArrowUpRight, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/Card';
import { generateMonthlyPDFReport } from '../lib/pdfExport';

const PieAny = Pie as any;

export function Analytics() {
  const { currentUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const transactions = useLiveQuery(
    () => currentUser ? db.transactions.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];
  
  const categories = useLiveQuery(
    () => currentUser ? db.categories.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const debts = useLiveQuery(
    () => currentUser ? db.debts.where('userId').equals(currentUser.id!).toArray() : [],
    [currentUser?.id]
  ) || [];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const monthlyTransactions = useMemo(() => {
    return transactions.filter(tx => 
      isWithinInterval(tx.date, { start: monthStart, end: monthEnd })
    );
  }, [transactions, monthStart, monthEnd]);

  const monthlyDebts = useMemo(() => {
    return debts.filter(debt => 
      isWithinInterval(debt.date, { start: monthStart, end: monthEnd })
    );
  }, [debts, monthStart, monthEnd]);

  const { totalExpense, totalIncome } = useMemo(() => {
    return monthlyTransactions.reduce(
      (acc, tx) => {
        if (tx.type === 'expense') acc.totalExpense += tx.amount;
        if (tx.type === 'income') acc.totalIncome += tx.amount;
        return acc;
      },
      { totalExpense: 0, totalIncome: 0 }
    );
  }, [monthlyTransactions]);

  const { totalPayable, totalReceivable } = useMemo(() => {
    return monthlyDebts.reduce(
      (acc, debt) => {
        if (debt.status === 'unpaid') {
          const actualAmount = debt.remainingAmount !== undefined ? debt.remainingAmount : debt.amount;
          if (debt.type === 'payable') acc.totalPayable += actualAmount;
          if (debt.type === 'receivable') acc.totalReceivable += actualAmount;
        }
        return acc;
      },
      { totalPayable: 0, totalReceivable: 0 }
    );
  }, [monthlyDebts]);

  // Daily Data for Bar/Line Charts
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return days.map(day => {
      const dayTxs = monthlyTransactions.filter(tx => 
        new Date(tx.date).getDate() === day.getDate()
      );
      
      const income = dayTxs.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
      const expense = dayTxs.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
      
      return {
        date: format(day, 'MMM dd'),
        day: day.getDate(),
        income,
        expense,
        balance: income - expense
      };
    });
  }, [monthlyTransactions, monthStart, monthEnd]);

  // Category Data for Pie Chart
  const categoryData = useMemo(() => {
    const expenses = monthlyTransactions.filter(tx => tx.type === 'expense');
    const grouped = expenses.reduce((acc, tx) => {
      acc[tx.categoryId] = (acc[tx.categoryId] || 0) + tx.amount;
      return acc;
    }, {} as Record<number, number>);

    return Object.entries(grouped).map(([catId, amount]) => {
      const category = categories.find(c => c.id === Number(catId));
      return {
        name: category?.name || 'Unknown',
        value: amount,
        color: category?.color || '#8b5cf6'
      };
    }).sort((a, b) => b.value - a.value);
  }, [monthlyTransactions, categories]);

  const COLORS = ['#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#3B82F6', '#EF4444', '#14B8A6'];

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleDownloadPDF = async () => {
    if (!currentUser?.id) return;
    setIsDownloading(true);
    try {
      await generateMonthlyPDFReport(
        currentUser.id,
        currentUser.name,
        currentUser.email || '',
        currentDate.getFullYear(),
        currentDate.getMonth() + 1
      );
    } catch (error) {
      console.error('Error downloading monthly PDF report:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-3xl mt-8">
        Please log in to view your analytics.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 relative">
      {/* Header & Month Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <h2 className="text-2xl font-bold tracking-tight">Monthly Analysis</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <button onClick={handlePrevMonth} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-slate-900 dark:text-white min-w-[100px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button onClick={handleNextMonth} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <ChevronRight size={20} />
            </button>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-2xl font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm shadow-violet-500/20"
          >
            <Download size={18} />
            <span className="hidden sm:inline">{isDownloading ? 'Generating...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <TrendingUp size={18} />
            <span className="text-sm font-medium">Income</span>
          </div>
          <span className="text-xl font-bold">{formatCurrency(totalIncome)}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <TrendingDown size={18} />
            <span className="text-sm font-medium">Expense</span>
          </div>
          <span className="text-xl font-bold">{formatCurrency(totalExpense)}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-orange-500 dark:text-orange-400">
            <ArrowUpRight size={18} />
            <span className="text-sm font-medium">Receivable (পাওনা)</span>
          </div>
          <span className="text-xl font-bold">{formatCurrency(totalReceivable)}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400">
            <ArrowDownRight size={18} />
            <span className="text-sm font-medium">Payable (দেনা)</span>
          </div>
          <span className="text-xl font-bold">{formatCurrency(totalPayable)}</span>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Income & Expense Transactions Table */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-6">Income & Expense Table (আয়-ব্যয় তালিকা)</h3>
          <div className="overflow-x-auto max-h-[288px] custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-[0_1px_0_0_rgba(148,163,184,0.1)]">
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                  <th className="pb-3 pr-2 font-semibold text-center w-8">No.</th>
                  <th className="pb-3 pr-4 font-semibold w-24">Date</th>
                  <th className="pb-3 pr-4 font-semibold">Category / Note</th>
                  <th className="pb-3 font-semibold text-right w-24">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                {monthlyTransactions.sort((a, b) => b.date.getTime() - a.date.getTime()).map((tx, idx) => {
                  const category = categories.find(c => c.id === tx.categoryId);
                  const isInc = tx.type === 'income';
                  return (
                    <tr key={tx.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 pr-2 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-3 pr-4 text-slate-500 text-xs font-mono">{format(tx.date, 'dd MMM yyyy')}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs md:text-sm">{category?.name || 'Unknown'}</span>
                          {tx.note && <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[130px]">{tx.note}</span>}
                        </div>
                      </td>
                      <td className={`py-3 text-right font-bold text-xs md:text-sm ${isInc ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isInc ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  );
                })}
                {monthlyTransactions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 text-xs">
                      No transactions found for this month (এই মাসের কোনো লেনদেন নেই)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Expense by Category Pie Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-6">Expense by Category</h3>
          {categoryData.length > 0 ? (
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="h-64 w-full md:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <PieAny
                      activeIndex={activeIndex !== null ? activeIndex : undefined}
                      activeShape={(props: any) => {
                        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                        return (
                          <g>
                            <Sector
                              cx={cx}
                              cy={cy}
                              innerRadius={innerRadius}
                              outerRadius={outerRadius + 8}
                              startAngle={startAngle}
                              endAngle={endAngle}
                              fill={fill}
                            />
                            <Sector
                              cx={cx}
                              cy={cy}
                              startAngle={startAngle}
                              endAngle={endAngle}
                              innerRadius={outerRadius + 12}
                              outerRadius={outerRadius + 15}
                              fill={fill}
                            />
                          </g>
                        );
                      }}
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color || COLORS[index % COLORS.length]}
                          stroke="none"
                          className="transition-all duration-300 cursor-pointer"
                        />
                      ))}
                    </PieAny>
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        backgroundColor: 'var(--chart-tooltip-bg)',
                        color: 'var(--chart-text)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="w-full md:w-1/2 space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {categoryData.map((entry, index) => {
                  const percentage = ((entry.value / totalExpense) * 100).toFixed(1);
                  const isActive = activeIndex === index;
                  
                  return (
                    <div 
                      key={`legend-${index}`} 
                      className={cn(
                        "flex items-center justify-between gap-4 text-sm p-2 rounded-xl transition-all duration-200",
                        isActive ? "bg-slate-100 dark:bg-slate-800 scale-[1.02]" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: entry.color }} 
                        />
                        <span className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[120px]">
                          {entry.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <span>{formatCurrency(entry.value)}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-slate-400">
              No expenses this month
            </div>
          )}
        </Card>

        {/* Daily Balance Trend Area Chart */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-bold mb-6">Daily Net Balance Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" opacity={0.5} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--chart-text)' }} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--chart-text)' }} tickFormatter={(value) => `$${value}`} />
                <RechartsTooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'var(--chart-tooltip-bg)',
                    color: 'var(--chart-text)'
                  }}
                />
                <Area type="monotone" dataKey="balance" name="Net Balance" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly Transactions List */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-bold mb-6">Transactions ({format(currentDate, 'MMM yyyy')})</h3>
          <div className="space-y-4">
            {monthlyTransactions.length > 0 ? (
              monthlyTransactions.sort((a, b) => b.date.getTime() - a.date.getTime()).map(tx => {
                const category = categories.find(c => c.id === tx.categoryId);
                return (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: category?.color || '#8b5cf6' }}
                      >
                        <span className="text-xl">{category?.icon || '💰'}</span>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{category?.name || 'Unknown'}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{format(tx.date, 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                    <div className={`font-bold ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                No transactions found for this month.
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
