"""Draws the Alpha Sprint burn-up chart from the recorded CSV.

The chart reads `burnup-data.csv` and nothing else, so the picture can always
be reproduced from the raw data in the repository. Days without a recorded
accepted count are left empty on purpose: the future of the sprint is not
predicted.
"""
import csv
import sys
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / 'docs' / 'evidence' / 'assignment5-alpha' / 't4-competitions-teams' / 'burnup-data.csv'
OUTPUT = ROOT / 'docs' / 'evidence' / 'assignment5-alpha' / 't4-competitions-teams' / 'burnup-day3-day4.png'


def read_rows():
    with CSV_PATH.open(encoding='utf-8', newline='') as handle:
        rows = list(csv.DictReader(handle))
    dates = [datetime.strptime(row['Date'], '%Y-%m-%d') for row in rows]
    total = [int(row['Total Scope']) for row in rows]
    accepted = [int(row['Accepted Tasks']) if row['Accepted Tasks'].strip() else None for row in rows]
    return dates, total, accepted


def main():
    dates, total, accepted = read_rows()
    labels = [date.strftime('%m-%d') for date in dates]
    recorded = [value for value in accepted if value is not None]
    last_recorded = max(index for index, value in enumerate(accepted) if value is not None)

    figure, axes = plt.subplots(figsize=(15.5, 8.7), dpi=100)
    figure.patch.set_facecolor('white')
    axes.set_facecolor('white')

    axes.plot(labels, total, linestyle=(0, (7, 5)), linewidth=3, color='#8B4513',
              label='Total Scope', zorder=2)
    axes.plot(labels[:last_recorded + 1], recorded, marker='o', markersize=11, linewidth=3.5,
              color='#2563EB', markerfacecolor='white', markeredgewidth=3, markeredgecolor='#2563EB',
              label='Accepted Tasks', zorder=3)

    axes.axvline(labels[last_recorded], color='#B9C4D3', linestyle='--', linewidth=1.6, zorder=1)
    axes.text(last_recorded + 0.12, 6.9, 'not yet recorded', color='#8E9AAF', fontsize=13,
              style='italic')

    axes.annotate(f'{recorded[-1]} of {total[-1]} accepted',
                  xy=(labels[last_recorded], recorded[-1]), xytext=(0, 30),
                  textcoords='offset points', ha='center', fontsize=15, fontweight='bold',
                  color='#14213D')

    axes.set_title('CodeStrike Alpha Sprint Burn-up Chart', fontsize=26, fontweight='bold',
                   color='#14213D', pad=22)
    axes.set_xlabel('Date (November 2026)', fontsize=17, color='#475467', labelpad=14)
    axes.set_ylabel('Accepted Tasks', fontsize=17, color='#475467', labelpad=14)
    axes.set_ylim(-0.3, 10)
    axes.set_xlim(-0.3, len(labels) - 0.7)
    axes.set_yticks(range(0, 11))
    axes.tick_params(axis='both', labelsize=14, colors='#667085')
    axes.grid(axis='y', color='#E4E8EE', linewidth=1)
    axes.set_axisbelow(True)
    for spine in ('top', 'right'):
        axes.spines[spine].set_visible(False)
    axes.spines['left'].set_color('#D7DEE7')
    axes.spines['bottom'].set_color('#D7DEE7')
    legend = axes.legend(loc='lower right', frameon=False, fontsize=16)
    for text in legend.get_texts():
        text.set_color('#14213D')

    figure.tight_layout()
    figure.savefig(OUTPUT, facecolor='white')
    print(f'wrote {OUTPUT}')
    print(f'recorded days: {labels[0]} to {labels[last_recorded]}, accepted {recorded[-1]} of {total[-1]}')


if __name__ == '__main__':
    main()
