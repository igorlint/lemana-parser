import subprocess
import json
import time
import os

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
results_file = "batch_results.json"

# Load existing results if any
results = []
if os.path.exists(results_file):
    try:
        with open(results_file, "r") as f:
            results = json.load(f)
        print(f"🔄 Resuming... Loaded {len(results)} items from {results_file}", flush=True)
    except:
        print("⚠️ Could not load existing results, starting fresh.", flush=True)

# Helper to find if SKU exists in results
def find_item(sku):
    for r in results:
        if r["sku"] == sku:
            return r
    return None

print(f"🚀 Starting/Resuming batch processing for {len(items)} items...", flush=True)

for item in items:
    sku = item["sku"]
    existing_item = find_item(sku)
    
    if not existing_item:
        existing_item = {"sku": sku}
        results.append(existing_item)
    
    item_results = existing_item
    
    for region in regions:
        # Check if we already have a valid price (not Error, not Timeout, and exists)
        current_val = item_results.get(region)
        if current_val and current_val not in ["Error", "Timeout", ""]:
            # print(f"⏩ Skipping {sku} | {region} (Already: {current_val})", flush=True)
            continue
            
        print(f"🔄 Processing SKU: {sku} | Region: {region}", flush=True)
        
        # Reduced timeout since we have fast polling now
        cmd = [
            "xvfb-run", "-a", "-s", "-screen 0 1920x1080x24",
            "./venv/bin/python3", "lib/parser_pyautogui.py",
            sku, region, "", "true", "60"
        ]
        
        try:
            # Run the parser and capture output
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            output = result.stdout
            
            # Extract JSON output
            price = "Error"
            found_status = False
            for line in output.splitlines():
                if line.startswith('{"status":'):
                    try:
                        data = json.loads(line)
                        if data.get("status") == "success":
                            price = data.get("price")
                            found_status = True
                    except: pass
            
            if found_status:
                print(f"   ✅ Price: {price}", flush=True)
            else:
                print(f"   ❌ Price Not Found (Log: {output[-200:].replace(chr(10), ' ')})", flush=True)
            
            item_results[region] = price
            
        except subprocess.TimeoutExpired:
            print(f"   ❌ Timeout", flush=True)
            item_results[region] = "Timeout"
        except Exception as e:
            print(f"   ❌ Error: {e}", flush=True)
            item_results[region] = "Error"
        
        # Save after EVERY update
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)

# Generate Markdown Table at the end
md_table = "| SKU | Klin | SPB | Surgut |\n|---|---|---|---|\n"
for r in results:
    md_table += f"| {r['sku']} | {r.get('klin', '-')} | {r.get('spb', '-')} | {r.get('surgut', '-')} |\n"

with open("batch_report.md", "w") as f:
    f.write("# Batch Processing Results\n\n")
    f.write(md_table)

print("\n🎉 Batch processing complete! Results saved to batch_results.json and batch_report.md", flush=True)
