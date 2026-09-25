# Configuration

`config/` contains market/runtime configuration, not executable test inventory.

`config/markets/` is the current home for market-specific configuration that can be shared by multiple suites/environments.

Target rule: S1/S2 differences should be represented as runtime endpoints/environment selection rather than duplicated specs wherever business behavior is equivalent.

Do not place credentials, cookies or payment data here. Runtime secrets remain under ignored `playwright/.auth/` and Jenkins Secret files.
