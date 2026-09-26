/**
 * Financial Calculation Engine adhering strictly to 04-FINANCIAL_LOGIC.md
 */

export function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'â‚¹0';
  const isNegative = amount < 0;
  const absVal = Math.abs(Math.round(amount));
  
  // Format with Indian currency digit grouping: e.g. 1,62,500
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(absVal);

  return isNegative ? `-â‚¹${formatted}` : `â‚¹${formatted}`;
}

export function calculateStallFinancials(stallId, dbData) {
  const stall = dbData.stalls.find(s => s.id === stallId);
  if (!stall) return null;

  // 1. Calculate Gross Sales from VERIFIED submissions ONLY
  const verifiedSubmissions = dbData.sales_submissions.filter(
    sub => sub.stall_id === stallId && sub.status === 'verified'
  );

  const pendingSubmissions = dbData.sales_submissions.filter(
    sub => sub.stall_id === stallId && sub.status === 'pending'
  );

  const rejectedSubmissions = dbData.sales_submissions.filter(
    sub => sub.stall_id === stallId && sub.status === 'rejected'
  );

  const onlineSales = verifiedSubmissions.reduce((acc, sub) => acc + (sub.online_total || 0), 0);
  const offlineSales = verifiedSubmissions.reduce((acc, sub) => acc + (sub.offline_total || 0), 0);
  const grossSales = onlineSales + offlineSales;

  // Pending totals (for coordinator visibility, not in official gross)
  const pendingOnline = pendingSubmissions.reduce((acc, sub) => acc + (sub.online_total || 0), 0);
  const pendingOffline = pendingSubmissions.reduce((acc, sub) => acc + (sub.offline_total || 0), 0);
  const pendingTotal = pendingOnline + pendingOffline;

  // 2. Calculate Total Expenses
  const expenses = dbData.stall_expenses.filter(exp => exp.stall_id === stallId);
  const totalExpenses = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);

  // Categorize expenses
  const expensesByCategory = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {});

  // 3. Net Profit: Gross Sales - Total Expenses
  const netProfit = grossSales - totalExpenses;

  // 4. Break-even check
  const isBreakEven = grossSales >= totalExpenses && totalExpenses > 0;

  // 5. % of Expenses Recovered: min(100, round(Gross Sales Ã· Total Expenses Ã— 100))
  // Edge case: Total Expenses = 0
  let recoveredPercent = null;
  let recoveredPercentDisplay = 'N/A';
  if (totalExpenses > 0) {
    const rawPct = (grossSales / totalExpenses) * 100;
    recoveredPercent = Math.min(100, Math.round(rawPct));
    recoveredPercentDisplay = `${recoveredPercent}%`;
  } else if (grossSales > 0) {
    recoveredPercent = 100;
    recoveredPercentDisplay = '100% (No Expenses)';
  }

  // 6. Amount Needed to Break Even
  const amountNeeded = isBreakEven || totalExpenses === 0 ? 0 : Math.max(0, totalExpenses - grossSales);

  return {
    stall_id: stall.id,
    stall_name: stall.name,
    category: stall.category,
    status: stall.status,
    gross_sales: grossSales,
    gross_sales_formatted: formatINR(grossSales),
    online_sales: onlineSales,
    online_sales_formatted: formatINR(onlineSales),
    offline_sales: offlineSales,
    offline_sales_formatted: formatINR(offlineSales),
    total_expenses: totalExpenses,
    total_expenses_formatted: formatINR(totalExpenses),
    net_profit: netProfit,
    net_profit_formatted: formatINR(netProfit),
    is_profitable: netProfit > 0,
    is_break_even: isBreakEven,
    recovered_percent: recoveredPercent,
    recovered_percent_display: recoveredPercentDisplay,
    amount_needed: amountNeeded,
    amount_needed_formatted: formatINR(amountNeeded),
    pending_submissions_count: pendingSubmissions.length,
    pending_total: pendingTotal,
    pending_total_formatted: formatINR(pendingTotal),
    verified_submissions_count: verifiedSubmissions.length,
    rejected_submissions_count: rejectedSubmissions.length,
    expenses_by_category: expensesByCategory
  };
}

export function calculateEventSummary(dbData) {
  const stallSummaries = dbData.stalls.map(s => calculateStallFinancials(s.id, dbData));

  const totalGrossSales = stallSummaries.reduce((sum, s) => sum + s.gross_sales, 0);
  const totalOnlineSales = stallSummaries.reduce((sum, s) => sum + s.online_sales, 0);
  const totalOfflineSales = stallSummaries.reduce((sum, s) => sum + s.offline_sales, 0);
  const totalExpenses = stallSummaries.reduce((sum, s) => sum + s.total_expenses, 0);
  const totalNetProfit = totalGrossSales - totalExpenses;
  
  const profitableStallsCount = stallSummaries.filter(s => s.is_profitable).length;
  const breakEvenStallsCount = stallSummaries.filter(s => s.is_break_even).length;
  const totalStallsCount = stallSummaries.length;

  const pendingSubmissions = dbData.sales_submissions.filter(s => s.status === 'pending');
  const pendingTotal = pendingSubmissions.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  // Leaderboard ranking sorted by verified Gross Sales descending
  const leaderboard = [...stallSummaries]
    .sort((a, b) => b.gross_sales - a.gross_sales)
    .map((s, index) => ({
      ...s,
      rank: index + 1,
      medal: index === 0 ? 'ðŸ¥‡' : index === 1 ? 'ðŸ¥ˆ' : index === 2 ? 'ðŸ¥‰' : null
    }));

  // Attendance stats
  const totalMembers = dbData.users.filter(u => u.role === 'member').length;
  const confirmedAttendance = (dbData.attendance_records || []).filter(a => a.status === 'confirmed').length;
  const pendingAttendance = (dbData.attendance_records || []).filter(a => a.status === 'pending_coordinator').length;
  const attendanceRate = totalMembers > 0 ? Math.round((confirmedAttendance / totalMembers) * 100) : 0;

  return {
    event_name: 'Building Pravara 2026',
    total_stalls: totalStallsCount,
    total_gross_sales: totalGrossSales,
    total_gross_sales_formatted: formatINR(totalGrossSales),
    total_online_sales: totalOnlineSales,
    total_online_sales_formatted: formatINR(totalOnlineSales),
    total_offline_sales: totalOfflineSales,
    total_offline_sales_formatted: formatINR(totalOfflineSales),
    total_expenses: totalExpenses,
    total_expenses_formatted: formatINR(totalExpenses),
    total_net_profit: totalNetProfit,
    total_net_profit_formatted: formatINR(totalNetProfit),
    profitable_stalls_count: profitableStallsCount,
    break_even_stalls_count: breakEvenStallsCount,
    break_even_rate: totalStallsCount > 0 ? Math.round((breakEvenStallsCount / totalStallsCount) * 100) : 0,
    pending_submissions_count: pendingSubmissions.length,
    pending_submissions_total: pendingTotal,
    pending_submissions_total_formatted: formatINR(pendingTotal),
    attendance: {
      total_members: totalMembers,
      confirmed: confirmedAttendance,
      pending: pendingAttendance,
      rate: attendanceRate
    },
    leaderboard
  };
}

