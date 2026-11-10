package io.samsung.qa.home;

import hudson.Extension;
import hudson.model.Descriptor;
import hudson.plugins.view.dashboard.DashboardPortlet;
import jenkins.YesNoMaybe;
import jenkins.model.Jenkins;
import org.kohsuke.stapler.DataBoundConstructor;

/** Presentation extension only: no jobs, credentials, tasks or global configuration. */
public final class ControlCenterPortlet extends DashboardPortlet {
    @DataBoundConstructor
    public ControlCenterPortlet(String name) {
        super(name);
    }

    public String getAssetVersion() {
        var plugin = Jenkins.get().getPluginManager().getPlugin("samsung-smb-home");
        return plugin == null ? "development" : plugin.getVersion();
    }

    @Extension(dynamicLoadable = YesNoMaybe.YES)
    public static final class DescriptorImpl extends Descriptor<DashboardPortlet> {
        @Override
        public String getDisplayName() {
            return "Samsung SMB QA Automation Center";
        }
    }
}
