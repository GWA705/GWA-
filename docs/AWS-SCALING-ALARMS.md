# AWS capacity — auto-scaling + CloudWatch alarms runbook

Goal: remove the two capacity risks in today's setup — (1) **single point of
failure** (one instance; a crash = downtime) and (2) **no headroom on a spike**
(no auto-scaling; burstable CPU credits can deplete) — and get **early warning**
before the box tips over.

## Current environment (facts, from `AWS-CUTOVER-PROGRESS.md`)

| Thing | Value |
|---|---|
| Region | `ca-central-1` |
| EB application env | `Gwa-portal-env` (ID `e-bbrkucgda3`), Docker on AL2023 |
| Instance | **single `t3.small`** (2 vCPU / 2 GB), x86_64, default VPC public subnets |
| Front door | CloudFront `E163FPGPE2W8Z3` → EB origin (HTTP), WAF attached |
| Database | RDS `gwa-portal-db` (AZ `ca-central-1d`) |
| Storage | S3 `gwa-portal-documents` |

> The app + DB are co-located in `ca-central-1`, so the old cross-region latency
> (PERFORMANCE.md) is resolved. The remaining risk is **compute resilience**, not
> query distance.

---

## Part A — Auto-scaling (resilience + spike headroom)

The env is currently **single-instance** (no load balancer). Two levels of fix:

### Option 1 — Minimum viable resilience (recommended first step)
Convert the env to **load-balanced** with **min 1 / max 2** so a crashed instance
is replaced with zero downtime and a spike can add a second box. This adds an ALB
(~$16/mo) but ends the single-point-of-failure.

Console path: **Elastic Beanstalk → Gwa-portal-env → Configuration → Capacity →
Edit**
- Environment type: **Load balanced**
- Instances: **Min 1**, **Max 2** (raise Max to 3 later if needed)
- Instance types: keep `t3.small` (or add `t3.medium` — see Part C)
- Scaling triggers (see below)
- Save → EB rebuilds the env (a few minutes; do it in a low-traffic window)

Then re-point CloudFront's origin from the single-instance URL to the **new ALB
DNS name** if it changes (Configuration shows the new env URL; CloudFront origin =
that host, HTTP).

### Scaling trigger (both options)
Scale out on sustained CPU, scale in when quiet:
- Metric: `CPUUtilization`, Statistic `Average`, Unit `Percent`
- **Upper threshold 65% for 2 consecutive 1-min periods → +1 instance**
- **Lower threshold 25% for 5 periods → −1 instance**
- Breach duration 60s, cooldown 300s

### Option 2 — CLI (EB CLI) equivalent
```bash
# from the repo (eb init already done in AWS-CUTOVER); shows current config
eb config Gwa-portal-env
# edit the pulled config: set
#   aws:elasticbeanstalk:environment  EnvironmentType: LoadBalanced
#   aws:autoscaling:asg               MinSize: 1   MaxSize: 2
#   aws:autoscaling:trigger           MeasureName: CPUUtilization
#                                     Statistic: Average  Unit: Percent
#                                     UpperThreshold: 65  LowerThreshold: 25
#                                     BreachDuration: 1   Period: 1
# then save; eb applies it:
eb config Gwa-portal-env   # re-open to confirm, or `eb deploy` after a config commit
```
Or commit these as `.ebextensions/scaling.config` so they're versioned:
```yaml
# .ebextensions/scaling.config
option_settings:
  aws:elasticbeanstalk:environment:
    EnvironmentType: LoadBalanced
  aws:autoscaling:asg:
    MinSize: 1
    MaxSize: 2
  aws:autoscaling:trigger:
    MeasureName: CPUUtilization
    Statistic: Average
    Unit: Percent
    UpperThreshold: 65
    LowerThreshold: 25
    BreachDuration: 1
    Period: 1
```

> Note: the deploy pipeline sets `wait_for_deployment: false` because the
> single-instance env flaps Yellow on low traffic. Moving to load-balanced also
> makes health reporting stable, so that flag can later be flipped back to `true`.

---

## Part B — CloudWatch alarms (early warning)

Create these in **CloudWatch → Alarms → Create alarm** (region `ca-central-1`),
each notifying an **SNS topic** (create one, e.g. `gwa-ops-alerts`, and subscribe
Sean's email). CLI snippets assume that topic's ARN in `$TOPIC`.

| # | Alarm | Metric | Threshold | Why |
|---|-------|--------|-----------|-----|
| 1 | High CPU | EC2 `CPUUtilization` (env ASG) | > 80% avg, 3× 1-min | Box saturating |
| 2 | **CPU credits draining** | EC2 `CPUCreditBalance` | < 40 for 15 min | t3 burst is running out → throttling imminent |
| 3 | Low memory | `mem_used_percent` (CW agent) | > 85% for 5 min | 2 GB is the real ceiling (OCR/PDF) |
| 4 | Instance unhealthy | EB `EnvironmentHealth` | ≠ Green (or Severe) 5 min | Crash/replace visibility |
| 5 | 5xx spike | ALB `HTTPCode_Target_5XX_Count` | > 10 in 5 min | App erroring under load |
| 6 | RDS CPU | RDS `CPUUtilization` | > 80% for 10 min | DB is the shared bottleneck |
| 7 | RDS connections | RDS `DatabaseConnections` | > 80% of max | Prisma pool exhaustion |
| 8 | RDS free storage | RDS `FreeStorageSpace` | < 2 GB | Disk-full outage |
| 9 | RDS freeable memory | RDS `FreeableMemory` | < 200 MB | DB thrashing |

### Memory metric needs the CloudWatch agent
EC2/EB does **not** publish memory by default. Add the CloudWatch agent so alarm
#3 works — drop this in `.ebextensions/cloudwatch-agent.config` (installs + starts
the agent, publishing `mem_used_percent` and `disk_used_percent`):
```yaml
packages:
  yum:
    amazon-cloudwatch-agent: []
files:
  "/opt/aws/amazon-cloudwatch-agent/etc/cw-agent.json":
    mode: "000644"
    content: |
      { "metrics": { "namespace": "GWA/EB",
        "append_dimensions": { "InstanceId": "${aws:InstanceId}" },
        "metrics_collected": {
          "mem": { "measurement": ["mem_used_percent"] },
          "disk": { "measurement": ["disk_used_percent"], "resources": ["/"] } } } }
container_commands:
  01_start_cw_agent:
    command: "/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/cw-agent.json"
```

### Example CLI (alarm #2 — CPU credits, the sleeper risk on t3)
```bash
aws cloudwatch put-metric-alarm --region ca-central-1 \
  --alarm-name gwa-cpu-credits-low \
  --namespace AWS/EC2 --metric-name CPUCreditBalance \
  --dimensions Name=AutoScalingGroupName,Value=<env-ASG-name> \
  --statistic Average --period 300 --evaluation-periods 3 \
  --threshold 40 --comparison-operator LessThanThreshold \
  --alarm-actions "$TOPIC" --treat-missing-data notBreaching
```

---

## Part C — Right-sizing (optional headroom)

`t3.small` = 2 GB RAM. The heavy in-process jobs (tesseract OCR, pdf-lib, sharp
image resize, xlsx parse, Google-Sheets reads) can spike memory. If alarm #3 or #2
fires regularly, bump to **`t3.medium`** (4 GB) — change the instance type in
Capacity config; EB rolls it. This is a bigger lever than adding instances for
memory-bound work.

Also worth doing at the app layer (separate task): cap how many heavy jobs run at
once, and lean on the existing `gwa-doc-ocr` cron (already async, every 30 min) so
OCR stays off the request path.

---

## Suggested order of execution
1. **Alarms first** (Part B) — zero risk, immediate visibility, tells you whether
   scaling/right-sizing is even needed yet.
2. **Load-balanced min 1 / max 2** (Part A, Option 1) — ends the single point of
   failure.
3. **Right-size to t3.medium** (Part C) only if the memory/credit alarms say so.

## Doing it from this session
Connect the **AWS MCP** connector in claude.ai (Settings → Connectors → add "AWS
MCP", authenticate to the AWS account, then enable it in this chat). Once its
tools are live here, I can (a) pull the last few weeks of CloudWatch CPU/memory to
tell you your actual margin, and (b) create the SNS topic + alarms and apply the
capacity config directly, instead of you running the console steps by hand.
