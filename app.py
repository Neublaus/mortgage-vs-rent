from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from flask import Flask, render_template_string, request


app = Flask(__name__)


@dataclass
class Inputs:
    months_owned: int
    purchase_price: float
    current_value: float
    monthly_piti_hoa_ins: float
    monthly_principal_paid: float
    monthly_rent_zestimate: float
    annual_itemized_deductions: float
    annual_standard_deduction: float
    marginal_tax_rate: float
    down_payment_pct: float
    buy_closing_cost: float
    points_paid: float
    assumed_cash_return: float
    sell_closing_cost_pct_with_broker: float
    sell_closing_cost_pct_no_broker: float


def future_value(principal: float, annual_rate: float, months: int) -> float:
    return principal * ((1 + annual_rate / 12) ** months)


def monthly_tax_savings(inp: Inputs) -> float:
    excess = max(inp.annual_itemized_deductions - inp.annual_standard_deduction, 0)
    return (excess * inp.marginal_tax_rate) / 12


def run_scenarios(inp: Inputs) -> Dict[str, float]:
    total_paid = inp.monthly_piti_hoa_ins * inp.months_owned
    total_principal = inp.monthly_principal_paid * inp.months_owned
    tax_save_total = monthly_tax_savings(inp) * inp.months_owned

    effective_housing_cost_total = total_paid - total_principal - tax_save_total
    effective_housing_cost_monthly = effective_housing_cost_total / inp.months_owned

    rent_total = inp.monthly_rent_zestimate * inp.months_owned
    overpay_vs_rent_total = effective_housing_cost_total - rent_total
    overpay_vs_rent_monthly = overpay_vs_rent_total / inp.months_owned

    down_payment = inp.purchase_price * inp.down_payment_pct
    upfront_cash = down_payment + inp.buy_closing_cost + inp.points_paid
    invested_value = future_value(upfront_cash, inp.assumed_cash_return, inp.months_owned)
    opportunity_cost_total = invested_value - upfront_cash
    opportunity_cost_monthly = opportunity_cost_total / inp.months_owned

    net_sale_with_broker = inp.current_value * (1 - inp.sell_closing_cost_pct_with_broker)
    net_sale_no_broker = inp.current_value * (1 - inp.sell_closing_cost_pct_no_broker)

    status_quo_monthly_buy_vs_rent = overpay_vs_rent_monthly + opportunity_cost_monthly

    required_sale_price_with_broker_to_break_even = (
        inp.purchase_price + inp.buy_closing_cost + inp.points_paid
    ) / (1 - inp.sell_closing_cost_pct_with_broker)
    required_sale_price_no_broker_to_break_even = (
        inp.purchase_price + inp.buy_closing_cost + inp.points_paid
    ) / (1 - inp.sell_closing_cost_pct_no_broker)

    return {
        "effective_housing_cost_total": effective_housing_cost_total,
        "effective_housing_cost_monthly": effective_housing_cost_monthly,
        "overpay_vs_rent_total": overpay_vs_rent_total,
        "overpay_vs_rent_monthly": overpay_vs_rent_monthly,
        "opportunity_cost_total": opportunity_cost_total,
        "opportunity_cost_monthly": opportunity_cost_monthly,
        "status_quo_monthly_buy_vs_rent": status_quo_monthly_buy_vs_rent,
        "net_sale_with_broker": net_sale_with_broker,
        "net_sale_no_broker": net_sale_no_broker,
        "required_sale_price_with_broker_to_break_even": required_sale_price_with_broker_to_break_even,
        "required_sale_price_no_broker_to_break_even": required_sale_price_no_broker_to_break_even,
    }


def as_money(x: float) -> str:
    return f"${x:,.2f}"


TEMPLATE = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Buy vs Rent Calculator</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; max-width: 980px; }
    h1 { margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; }
    label { display:block; font-size: 14px; }
    input { width: 100%; padding: 6px; margin-top: 4px; }
    button { margin-top: 16px; padding: 10px 14px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    td, th { border: 1px solid #ddd; padding: 8px; }
    th { background: #f5f5f5; text-align: left; }
  </style>
</head>
<body>
  <h1>Buy vs Rent Calculator</h1>
  <p>Enter your numbers, click <b>Calculate</b>, and review your results.</p>
  <form method="post">
    <div class="grid">
      {% for key, label, value in fields %}
      <label>{{ label }}
        <input name="{{ key }}" value="{{ value }}" required />
      </label>
      {% endfor %}
    </div>
    <button type="submit">Calculate</button>
  </form>

  {% if results %}
  <table>
    <tr><th>Scenario</th><th>Value</th></tr>
    {% for k, v in results.items() %}
      <tr><td>{{ k }}</td><td>{{ v }}</td></tr>
    {% endfor %}
  </table>
  {% endif %}
</body>
</html>
"""

DEFAULTS = {
    "months_owned": 36,
    "purchase_price": 600000,
    "current_value": 615000,
    "monthly_piti_hoa_ins": 3250,
    "monthly_principal_paid": 900,
    "monthly_rent_zestimate": 2800,
    "annual_itemized_deductions": 22000,
    "annual_standard_deduction": 14600,
    "marginal_tax_rate": 0.24,
    "down_payment_pct": 0.20,
    "buy_closing_cost": 12000,
    "points_paid": 6000,
    "assumed_cash_return": 0.05,
    "sell_closing_cost_pct_with_broker": 0.08,
    "sell_closing_cost_pct_no_broker": 0.03,
}

LABELS = {
    "months_owned": "Months owned",
    "purchase_price": "Purchase price",
    "current_value": "Current Zestimate",
    "monthly_piti_hoa_ins": "Monthly owner cost (PITI + HOA + insurance)",
    "monthly_principal_paid": "Monthly principal paid",
    "monthly_rent_zestimate": "Monthly Rent Zestimate",
    "annual_itemized_deductions": "Annual itemized deductions",
    "annual_standard_deduction": "Annual standard deduction",
    "marginal_tax_rate": "Marginal tax rate (e.g. 0.24)",
    "down_payment_pct": "Down payment % (e.g. 0.20)",
    "buy_closing_cost": "Buy closing cost",
    "points_paid": "Points paid",
    "assumed_cash_return": "Assumed annual return (e.g. 0.05)",
    "sell_closing_cost_pct_with_broker": "Sell closing % with broker",
    "sell_closing_cost_pct_no_broker": "Sell closing % no broker",
}


@app.route("/", methods=["GET", "POST"])
def home():
    values = DEFAULTS.copy()
    results = None

    if request.method == "POST":
        for key in values:
            raw = request.form.get(key, str(values[key])).strip()
            values[key] = float(raw)

        inp = Inputs(
            months_owned=int(values["months_owned"]),
            purchase_price=values["purchase_price"],
            current_value=values["current_value"],
            monthly_piti_hoa_ins=values["monthly_piti_hoa_ins"],
            monthly_principal_paid=values["monthly_principal_paid"],
            monthly_rent_zestimate=values["monthly_rent_zestimate"],
            annual_itemized_deductions=values["annual_itemized_deductions"],
            annual_standard_deduction=values["annual_standard_deduction"],
            marginal_tax_rate=values["marginal_tax_rate"],
            down_payment_pct=values["down_payment_pct"],
            buy_closing_cost=values["buy_closing_cost"],
            points_paid=values["points_paid"],
            assumed_cash_return=values["assumed_cash_return"],
            sell_closing_cost_pct_with_broker=values["sell_closing_cost_pct_with_broker"],
            sell_closing_cost_pct_no_broker=values["sell_closing_cost_pct_no_broker"],
        )
        raw_results = run_scenarios(inp)
        results = {k.replace("_", " ").title(): as_money(v) for k, v in raw_results.items()}

    fields = [(k, LABELS[k], values[k]) for k in DEFAULTS]
    return render_template_string(TEMPLATE, fields=fields, results=results)


if __name__ == "__main__":
    app.run(debug=True)
