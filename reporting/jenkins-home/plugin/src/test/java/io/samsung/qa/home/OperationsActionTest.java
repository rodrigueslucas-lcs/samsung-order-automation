package io.samsung.qa.home;

import static org.junit.Assert.*;

import htmlpublisher.HtmlPublisherTarget;
import hudson.model.*;
import hudson.security.ACL;
import hudson.security.ACLContext;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import jenkins.model.Jenkins;
import net.sf.json.JSONObject;
import org.htmlunit.HttpMethod;
import org.htmlunit.WebRequest;
import org.junit.Rule;
import org.junit.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.MockAuthorizationStrategy;
import org.springframework.security.access.AccessDeniedException;

public class OperationsActionTest {
    @Rule
    public JenkinsRule j = new JenkinsRule();

    @Test
    public void snapshotIsReadOnlyAndReturnsOnlyApprovedJobs() throws Exception {
        FreeStyleProject project = j.createFreeStyleProject("Samsung-SMB-MX");
        j.createFreeStyleProject("Unrelated-private-job");
        project.addProperty(new ParametersDefinitionProperty(
                new ChoiceParameterDefinition("ENVIRONMENT", new String[] {"S2", "S1"}, "")));
        int before = project.getNextBuildNumber();
        JSONObject snapshot = new OperationsAction().snapshot();
        assertEquals(1, snapshot.getJSONArray("jobs").size());
        JSONObject row = snapshot.getJSONArray("jobs").getJSONObject(0);
        assertEquals("S2", row.getString("environment"));
        assertTrue(row.getBoolean("parameterized"));
        assertEquals(before, project.getNextBuildNumber());
        assertEquals(0, snapshot.getJSONArray("queue").size());
        assertFalse(snapshot.toString().contains("Unrelated-private-job"));
        JenkinsRule.WebClient client = j.createWebClient();
        String json = client.goTo("samsung-smb-home/snapshot", "application/json")
                .getWebResponse()
                .getContentAsString();
        assertEquals(1, JSONObject.fromObject(json).getJSONArray("jobs").size());
        client.getOptions().setThrowExceptionOnFailingStatusCode(false);
        WebRequest post = new WebRequest(new URL(j.getURL(), "samsung-smb-home/snapshot"), HttpMethod.POST);
        client.addCrumb(post);
        assertEquals(405, client.getPage(post).getWebResponse().getStatusCode());
        assertEquals(before, project.getNextBuildNumber());
    }

    @Test
    public void currentUserPermissionsNeverExposeAnotherJobsMetadata() throws Exception {
        j.createFreeStyleProject("Samsung-SMB-MX");
        FreeStyleProject peru = j.createFreeStyleProject("Samsung-SMB-PE");
        j.jenkins.setSecurityRealm(j.createDummySecurityRealm());
        j.jenkins.setAuthorizationStrategy(new MockAuthorizationStrategy()
                .grant(Jenkins.READ)
                .everywhere()
                .to("viewer")
                .grant(Item.READ)
                .onItems(peru)
                .to("viewer"));
        try (ACLContext ignored = ACL.as2(User.getById("viewer", true).impersonate2())) {
            JSONObject snapshot = new OperationsAction().snapshot();
            assertEquals(1, snapshot.getJSONArray("jobs").size());
            JSONObject row = snapshot.getJSONArray("jobs").getJSONObject(0);
            assertEquals("Samsung-SMB-PE", row.getString("name"));
            assertFalse(row.getBoolean("canBuild"));
        }
        try (ACLContext ignored = ACL.as2(Jenkins.ANONYMOUS2)) {
            assertThrows(AccessDeniedException.class, () -> new OperationsAction().snapshot());
        }
    }

    @Test
    public void publishedReportRequiresRealFilesAndRetainsItsOwnBuildIdentity() throws Exception {
        FreeStyleProject project = j.createFreeStyleProject("Samsung-SMB-EPP-CL");
        FreeStyleBuild first = project.scheduleBuild2(0).get();
        HtmlPublisherTarget target =
                new HtmlPublisherTarget("Quality Dashboard", "unused", "index.html", true, false, false);
        Path archive = Path.of(target.getArchiveTarget(first).getRemote());
        Files.createDirectories(archive);
        Files.writeString(archive.resolve("index.html"), "<h1>Quality</h1>");
        Files.writeString(
                archive.resolve("model.json"),
                "{\"gate\":\"PASSED WITH KNOWN DEFECTS\",\"buildNumber\":\"1\",\"market\":\"CL\",\"environment\":\"S2\",\"program\":\"alianzas\"}");
        first.addAction(target.new HTMLBuildAction(first, target));
        FreeStyleBuild second = project.scheduleBuild2(0).get();
        second.addAction(target.new HTMLBuildAction(second, target));
        assertEquals(1, OperationsAction.reports(project).size());
        assertEquals(1, OperationsAction.reports(project).getJSONObject(0).getInt("build"));
        assertEquals(
                "PASSED WITH KNOWN DEFECTS",
                OperationsAction.qualityGate(first, "EPP").getString("label"));
        assertNull(OperationsAction.qualityGate(second, "EPP"));
        assertNull(OperationsAction.qualityGate(first, "BASE_STORE"));
        Files.writeString(
                archive.resolve("model.json"),
                "{\"gate\":\"FULLY PASSED\",\"buildNumber\":\"1\",\"market\":\"MX\",\"environment\":\"S2\",\"program\":\"pymesmx\"}");
        assertNull(OperationsAction.qualityGate(first, "EPP"));
        assertTrue(OperationsAction.runData(first, System.currentTimeMillis()).getLong("duration") >= 0);
    }

    @Test
    public void onlyRecognizedReportKindsAreProjected() {
        assertNull(OperationsAction.reportType("configure"));
        assertEquals("Allure", OperationsAction.reportType("03_Allure_HTML"));
        assertEquals("Playwright", OperationsAction.reportType("02_Playwright"));
    }
}
