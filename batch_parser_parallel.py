import subprocess
import json
import time
import os
from concurrent.futures import ThreadPoolExecutor

items = [
    { "sku": "82471809" },
    { "sku": "82471810" },
    { "sku": "86745691" },
    { "sku": "83609120" },
    { "sku": "82471813" },
    { "sku": "82554714" },
    { "sku": "82554713" },
    { "sku": "86648552" },
    { "sku": "86745694" },
    { "sku": "86745693" },
    { "sku": "82471811" },
    { "sku": "82471812" },
    { "sku": "18584382" },
    { "sku": "82166042" },
    { "sku": "82166043" },
    { "sku": "89443959" }
]

regions = ["klin", "spb", "surgut"]
results_file = "batch_results_parallel.json"

# Load existing results
results = []
if os.path.exists(results_file):
    try:
        with open(results_file, "r") as f:
            results = json.load(f)
    except: pass

def find_item(sku):
    for r in results:
        if r["sku"] == sku:
            return r
    return None

def process_single_task(task):
    sku = task['sku']
    region = task['region']
    
    # Check if already done
    item_record = find_item(sku)
    if item_record and item_record.get(region) and item_record.get(region) not in ["Error", "Timeout"]:
        print(f"⏩ Skipped {sku} | {region}", flush=True)
        return
        
    print(f"🚀 Processing {sku} | {region}...", flush=True)
    
    cmd = [
        "xvfb-run", "-a", "-s", "-screen 0 1920x1080x24",
        "./venv/bin/python3", "lib/parser_pyautogui.py",
        sku, region, "", "true", "60"
    ]
    
    price = "Error"
    try:
        # 180s timeout to allow for 60s wait + 30s poll + overhead
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        output = res.stdout
        
        for line in output.splitlines():
            if line.startswith('{"status":'):
                try:
                    data = json.loads(line)
                    if data.get("status") == "success":
                        price = data.get("price")
                except: pass
    except subprocess.TimeoutExpired:
        price = "Timeout"
    except Exception as e:
        price = "Error"

    print(f"✅ Done {sku} | {region} -> {price}", flush=True)

    # Save immediately (Lock file in real app, but here simplistic)
    update_result(sku, region, price)

def update_result(sku, region, price):
    # Reload to be safe (race condition possible but rare-ish for file write in python atomic? No)
    # Just simplistic read-modify-write
    try:
        current_data = []
        if os.path.exists(results_file):
            with open(results_file, "r") as f:
                current_data = json.load(f)
        
        # Find or create
        found = False
        for item in current_data:
            if item["sku"] == sku:
                item[region] = price
                found = True
                break
        if not found:
            current_data.append({"sku": sku, region: price})
            
        with open(results_file, "w") as f:
            json.dump(current_data, f, indent=2)
    except:
        pass

# Generate Tasks
tasks = []
for item in items:
    for region in regions:
        tasks.append({"sku": item["sku"], "region": region})

print(f"🔥 Starting Parallel Batch of {len(tasks)} tasks with 6 workers...", flush=True)

with ThreadPoolExecutor(max_workers=6) as executor:
    executor.map(process_single_task, tasks)

print("🎉 All Parallel Tasks Completed!", flush=True)

# Generate Markdown
final_res = []
if os.path.exists(results_file):
    with open(results_file, "r") as f:
        final_res = json.load(f)

md_table = "| SKU | Klin | SPB | Surgut |\n|---|---|---|---|\n"
for r in final_res:
    md_table += f"| {r['sku']} | {r.get('klin', '-')} | {r.get('spb', '-')} | {r.get('surgut', '-')} |\n"

with open("batch_report.md", "w") as f:
    f.write("# Batch Processing Results\n\n")
    f.write(md_table)
