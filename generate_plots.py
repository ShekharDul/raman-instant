import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import savgol_filter
from scipy.optimize import curve_fit
import os

data_path = "src/assets/Sample_Data_2.txt"
artifact_dir = "C:/Users/55320/.gemini/antigravity-ide/brain/7c3b98bf-794f-4292-a81a-ad59046e4563"

# Load data
data = np.loadtxt(data_path, skiprows=1)
x = data[:, 0]
y = data[:, 1]
sort_idx = np.argsort(x)
x = x[sort_idx]
y = y[sort_idx]

# Institutional Luxury Style Settings
plt.style.use('default') # White background
color_raw = '#94a3b8' # Slate gray for raw data
color_corrected = '#0369a1' # Deep Academic Blue
color_fit = '#991b1b' # Authoritative Crimson
bg_color = '#ffffff'
grid_color = '#f1f5f9'
text_color = '#334155'
spine_color = '#cbd5e1'

def setup_axes(ax, title):
    ax.set_title(title, color='#0f172a', fontsize=16, pad=20, fontname='sans-serif', weight='bold')
    ax.set_xlabel("Raman Shift (cm$^{-1}$)", color=text_color, fontsize=12)
    ax.set_ylabel("Intensity (a.u.)", color=text_color, fontsize=12)
    ax.grid(True, color=grid_color, linestyle='-', linewidth=1)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color(spine_color)
    ax.spines['bottom'].set_color(spine_color)
    ax.tick_params(colors=text_color, labelsize=10)
    ax.set_facecolor(bg_color)
    
# 1. Raw Plot
fig, ax = plt.subplots(figsize=(10, 5), dpi=300)
ax.plot(x, y, color=color_raw, linewidth=1.2)
setup_axes(ax, "Raw Acquisition Data")
fig.patch.set_facecolor(bg_color)
fig.tight_layout()
plt.savefig(os.path.join(artifact_dir, "raw_plot.svg"), facecolor=bg_color)
plt.close()

# 2. Corrected Plot
def snip_baseline(y, iterations):
    baseline = np.copy(y)
    for p in range(1, iterations + 1):
        for i in range(p, len(y) - p):
            a = baseline[i]
            b = (baseline[i - p] + baseline[i + p]) / 2.0
            baseline[i] = min(a, b)
    return baseline

baseline = snip_baseline(y, 30)
y_corrected = y - baseline
y_smoothed = savgol_filter(y_corrected, window_length=11, polyorder=3)

fig, ax = plt.subplots(figsize=(10, 5), dpi=300)
ax.plot(x, y_smoothed, color=color_corrected, linewidth=1.5)
setup_axes(ax, "Automated Baseline Correction & Smoothing")
fig.patch.set_facecolor(bg_color)
fig.tight_layout()
plt.savefig(os.path.join(artifact_dir, "corrected_plot.svg"), facecolor=bg_color)
plt.close()

# 3. Peak Fitting
mask_1000_2000 = (x > 1000) & (x < 2000)
x_1000_2000 = x[mask_1000_2000]
y_1000_2000 = y_smoothed[mask_1000_2000]

max_idx_region = np.argmax(y_1000_2000)
max_x = x_1000_2000[max_idx_region]

region_mask = (x > max_x - 60) & (x < max_x + 60)
x_region = x[region_mask]
y_region = y_smoothed[region_mask]

def gaussian(x, a, x0, sigma):
    return a * np.exp(-(x - x0)**2 / (2 * sigma**2))

try:
    popt, pcov = curve_fit(gaussian, x_region, y_region, p0=[np.max(y_region), max_x, 10])
    y_fit = gaussian(x_region, *popt)
except:
    y_fit = y_region

fig, ax = plt.subplots(figsize=(8, 6), dpi=300)
ax.plot(x_region, y_region, 'o', color=color_corrected, markersize=4, label='Processed Data', alpha=0.8)
ax.plot(x_region, y_fit, color=color_fit, linewidth=2.5, label='Non-linear Gaussian Fit')
setup_axes(ax, "Spectral Deconvolution of Overlapping Bands")
ax.legend(frameon=True, facecolor='white', edgecolor=spine_color, labelcolor=text_color)
ax.fill_between(x_region, y_fit, 0, color=color_fit, alpha=0.08)
fig.patch.set_facecolor(bg_color)
fig.tight_layout()
plt.savefig(os.path.join(artifact_dir, "peak_fit.png"), facecolor=bg_color)
plt.close()

print("Institutional plots generated successfully.")
