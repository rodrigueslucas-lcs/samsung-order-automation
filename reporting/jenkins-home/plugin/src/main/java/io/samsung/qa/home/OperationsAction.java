package io.samsung.qa.home;

import htmlpublisher.HtmlPublisherTarget;
import hudson.Extension;
import hudson.FilePath;
import hudson.model.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import jenkins.YesNoMaybe;
import jenkins.model.Jenkins;
import net.sf.json.JSONArray;
import net.sf.json.JSONObject;
import org.kohsuke.stapler.StaplerRequest2;
import org.kohsuke.stapler.StaplerResponse2;

/** GET-only, current-user projection of ten approved jobs. Never impersonates SYSTEM. */
@Extension(dynamicLoadable = YesNoMaybe.YES)
public final class OperationsAction implements RootAction {
    public static final List<String> JOBS = List.of(
            "Samsung-SMB-MX",
            "Samsung-SMB-PE",
            "Samsung-SMB-CL",
            "Samsung-SMB-CO",
            "Samsung-SMB-EPP-MX",
            "Samsung-SMB-EPP-PE",
            "Samsung-SMB-EPP-CL",
            "Samsung-SMB-EPP-CO",
            "SAMSUNG-SMB-AUTOMATION",
            "Samsung-SMB-Auth-Operations");
    private static final Map<String, String> PROGRAMS =
            Map.of("MX", "pymesmx", "PE", "pe_membership_vip", "CL", "alianzas", "CO", "co_epp_agre");
    private static final Set<String> GATES = Set.of(
            "INFRA_ERROR",
            "FAILED — NEW REGRESSION",
            "BLOCKED BY EXTERNAL DEPENDENCIES",
            "PASSED WITH KNOWN DEFECTS",
            "FULLY PASSED",
            "TARGETED PASSED");

    @Override
    public String getIconFileName() {
        return null;
    }

    @Override
    public String getDisplayName() {
        return null;
    }

    @Override
    public String getUrlName() {
        return "samsung-smb-home";
    }

    public void doSnapshot(StaplerRequest2 req, StaplerResponse2 rsp) throws IOException {
        Jenkins.get().checkPermission(Jenkins.READ);
        if (!"GET".equals(req.getMethod())) {
            rsp.sendError(405);
            return;
        }
        rsp.setHeader("Cache-Control", "private, no-store");
        rsp.setContentType("application/json;charset=UTF-8");
        rsp.getWriter().write(snapshot().toString());
    }

    public JSONObject snapshot() {
        Jenkins j = Jenkins.get();
        j.checkPermission(Jenkins.READ);
        long now = System.currentTimeMillis();
        JSONArray rows = new JSONArray(), queued = new JSONArray(), running = new JSONArray();
        Set<String> visible = new HashSet<>();
        for (String name : JOBS) {
            Job<?, ?> job = j.getItemByFullName(name, Job.class);
            if (job == null || !job.hasPermission(Item.READ)) continue;
            visible.add(name);
            String store = name.startsWith("Samsung-SMB-EPP-")
                    ? "EPP"
                    : name.matches("Samsung-SMB-(MX|PE|CL|CO)") ? "BASE_STORE" : "OPERATIONS";
            String market = store.equals("OPERATIONS") ? "" : name.substring(name.lastIndexOf('-') + 1);
            Run<?, ?> completed = job.getLastCompletedBuild();
            Run<?, ?> activeContext = null;
            JSONArray active = new JSONArray();
            for (Run<?, ?> run : job.getBuilds().limit(20)) {
                if (run.isBuilding()) {
                    if (activeContext == null) activeContext = run;
                    JSONObject data = runData(run, now);
                    active.add(data);
                    running.add(new JSONObject().element("name", name).element("run", data));
                }
            }
            ParametersDefinitionProperty parameters = job.getProperty(ParametersDefinitionProperty.class);
            String environment =
                    store.equals("EPP") ? "S2" : environment(job, activeContext == null ? completed : activeContext);
            JSONObject proof = qualityGate(completed, store);
            JSONObject row = new JSONObject()
                    .element("name", name)
                    .element("url", job.getUrl())
                    .element("store", store)
                    .element("market", market)
                    .element("environment", environment)
                    .element(
                            "program",
                            store.equals("EPP")
                                    ? (proof == null ? PROGRAMS.get(market) : proof.getString("program"))
                                    : "")
                    .element(
                            "environmentSource",
                            activeContext != null
                                    ? "running"
                                    : completed != null ? "latest completed" : "configured default")
                    .element("canBuild", job.hasPermission(Item.BUILD) && job.isBuildable())
                    .element("parameterized", parameters != null)
                    .element("completed", completed == null ? null : runData(completed, now))
                    .element("lastSuccess", runData(job.getLastSuccessfulBuild(), now))
                    .element("lastFailure", runData(job.getLastFailedBuild(), now))
                    .element("running", active)
                    .element("reports", reports(job))
                    .element("qualityGate", proof)
                    .element(
                            "authDashboardAvailable",
                            name.equals("Samsung-SMB-Auth-Operations")
                                    && new java.io.File(j.getRootDir(), "userContent/samsung-smb-auth/s2/index.html")
                                            .isFile());
            rows.add(row);
        }
        for (hudson.model.Queue.Item item : j.getQueue().getItems()) {
            if (item.task instanceof Job<?, ?> job && visible.contains(job.getFullName())) {
                queued.add(new JSONObject()
                        .element("id", item.getId())
                        .element("name", job.getFullName())
                        .element("url", job.getUrl())
                        .element("since", item.getInQueueSince()));
            }
        }
        int total = 0, busy = 0;
        for (Computer computer : j.getComputers()) {
            if (!computer.isOnline() || !computer.isAcceptingTasks()) continue;
            total += computer.countExecutors();
            busy += computer.countBusy();
        }
        return new JSONObject()
                .element("observedAt", now)
                .element("jobs", rows)
                .element("running", running)
                .element("queue", queued)
                .element(
                        "executors",
                        new JSONObject()
                                .element("total", total)
                                .element("busy", busy)
                                .element("available", Math.max(0, total - busy)));
    }

    static JSONObject runData(Run<?, ?> run, long now) {
        if (run == null) return null;
        Result result = run.getResult();
        boolean building = run.isBuilding();
        long started = run.getStartTimeInMillis(), duration = run.getDuration();
        return new JSONObject()
                .element("number", run.getNumber())
                .element("url", run.getUrl())
                .element("result", result == null ? "UNKNOWN" : result.toString())
                .element("building", building)
                .element("startedAt", started)
                .element("duration", duration)
                .element("elapsed", building ? Math.max(0, now - started) : duration);
    }

    private static String environment(Job<?, ?> job, Run<?, ?> run) {
        ParametersAction action = run == null ? null : run.getAction(ParametersAction.class);
        ParameterValue value = action == null ? null : action.getParameter("ENVIRONMENT");
        if (value == null) {
            ParametersDefinitionProperty property = job.getProperty(ParametersDefinitionProperty.class);
            ParameterDefinition definition = property == null ? null : property.getParameterDefinition("ENVIRONMENT");
            value = definition == null ? null : definition.getDefaultParameterValue();
        }
        Object env = value == null ? null : value.getValue();
        return Set.of("S1", "S2").contains(String.valueOf(env)) ? String.valueOf(env) : "UNKNOWN";
    }

    static JSONArray reports(Job<?, ?> job) {
        JSONArray found = new JSONArray();
        Set<String> seen = new HashSet<>();
        for (Run<?, ?> run : job.getBuilds().limit(20)) {
            if (run.isBuilding()) continue;
            for (HtmlPublisherTarget.HTMLBuildAction action :
                    run.getActions(HtmlPublisherTarget.HTMLBuildAction.class)) {
                HtmlPublisherTarget target = action.getHTMLTarget();
                String path = action.getUrlName();
                String type = reportType(path);
                if (type == null || seen.contains(type) || !path.matches("[A-Za-z0-9_.-]+")) continue;
                try {
                    FilePath archive = target.getArchiveTarget(run);
                    boolean exists = false;
                    for (String file : target.getReportFiles().split(",")) {
                        String clean = file.trim();
                        if (!clean.isEmpty() && !clean.contains("..") && !clean.startsWith("/") && !clean.contains(":"))
                            exists |= archive.child(clean).exists();
                    }
                    if (!exists) continue;
                    found.add(new JSONObject()
                            .element("type", type)
                            .element("build", run.getNumber())
                            .element("url", run.getUrl() + path + "/"));
                    seen.add(type);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    return found;
                } catch (IOException ignored) {
                    /* A missing report never becomes a dead link. */
                }
            }
        }
        return found;
    }

    static String reportType(String path) {
        if (path == null) return null;
        String p = path.toLowerCase(Locale.ROOT);
        if (p.contains("regional")) return "Regional Summary";
        if (p.contains("allure")) return "Allure";
        if (p.contains("playwright")) return "Playwright";
        if (p.contains("executive") || p.contains("quality")) return "Quality Dashboard";
        return null;
    }

    /** Reads only an allowlisted scalar from the same completed run's public report. */
    static JSONObject qualityGate(Run<?, ?> run, String store) {
        if (run == null || !store.equals("EPP")) return null;
        for (HtmlPublisherTarget.HTMLBuildAction action : run.getActions(HtmlPublisherTarget.HTMLBuildAction.class)) {
            if (!"Quality Dashboard".equals(reportType(action.getUrlName()))) continue;
            try {
                Path file = Path.of(action.getHTMLTarget()
                        .getArchiveTarget(run)
                        .child("model.json")
                        .getRemote());
                if (!Files.isRegularFile(file) || Files.size(file) > 2_000_000) continue;
                JSONObject model = JSONObject.fromObject(Files.readString(file, StandardCharsets.UTF_8));
                String gate = model.optString("gate");
                String market = run.getParent().getName().replace("Samsung-SMB-EPP-", "");
                if (GATES.contains(gate)
                        && String.valueOf(run.getNumber()).equals(model.optString("buildNumber"))
                        && market.equals(model.optString("market"))
                        && "S2".equals(model.optString("environment"))
                        && model.optString("program").matches("[a-z][a-z0-9_]{1,60}"))
                    return new JSONObject()
                            .element("label", gate)
                            .element("build", run.getNumber())
                            .element("program", model.getString("program"));
            } catch (Exception ignored) {
                /* Missing/unreadable public proof stays unavailable. */
            }
        }
        return null;
    }
}
