pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '15'))
    timeout(time: 75, unit: 'MINUTES')
    skipDefaultCheckout(true)
    preserveStashes(buildCount: 5)
  }

  parameters {
    choice(name: 'MARKET', choices: ['MX', 'PE', 'CL', 'CO'], description: 'SMB market / storefront target. MX is the reference lane; PE S2 is the next stabilization lane. CL/CO are visible roadmap targets and remain runtime-guarded until enabled.')
    choice(name: 'ENVIRONMENT', choices: ['S1', 'S2'], description: 'Target staging environment. S1 = stg, S2 = stg2.')
    choice(name: 'TEST_SUITE', choices: ['fast-guest', 'authenticated-safe', 'official-p1', 'backoffice-safe', 'allure-smoke'], description: 'Execution profile. Functional suites use the shared Executive Dashboard + Playwright + Allure reporting standard.')
    choice(name: 'EXECUTION_MODE', choices: ['safe', 'authorized-destructive'], description: 'Safety mode. Full official-p1 payment/order execution requires authorized-destructive.')
    choice(name: 'BROWSER_MODE', choices: ['headless', 'headed'], description: 'Browser mode. Headless is recommended on Jenkins.')
    choice(name: 'EVIDENCE_MODE', choices: ['screenshots-trace', 'screenshots-trace-video'], description: 'Evidence capture. Video requires FFmpeg on the Jenkins agent.')
    string(name: 'P1_TARGET_IDS', defaultValue: '', description: 'Optional MX official-p1 stabilization filter. Comma/space separated active SAM IDs, e.g. SAM-24969,SAM-24991,SAM-25002. Leave empty for the full 29-TC P1.')
  }

  environment {
    CI = '1'
    MX_QST_USE_EXISTING_AUTH = '1'
    MX_AUTH_AUTO_RENEW = '0'
    ENABLE_ALLURE = '1'
    PLAYWRIGHT_BROWSERS_PATH = '0'
    NATIVE_ALLURE_PUBLISHED = '0'
  }

  stages {
    stage('01 · Build Context') {
      steps {
        script {
          def targetedIds = params.P1_TARGET_IDS?.trim()
            ? params.P1_TARGET_IDS.split(/[\\s,;]+/).findAll { it?.trim() }
            : []
          def p1Count = params.MARKET == 'MX' ? '29' : params.MARKET == 'PE' ? '28' : '—'
          def suiteLabel = [
            'fast-guest': 'FAST',
            'authenticated-safe': 'AUTH SAFE',
            'official-p1': targetedIds ? "P1 TARGETED · ${targetedIds.size()} TCs" : (p1Count == '—' ? 'P1' : "P1 · ${p1Count} TCs"),
            'backoffice-safe': 'BACKOFFICE',
            'allure-smoke': 'ALLURE SMOKE'
          ][params.TEST_SUITE] ?: params.TEST_SUITE.toUpperCase()
          def suiteFolder = [
            'fast-guest': 'fast',
            'authenticated-safe': 'auth',
            'official-p1': targetedIds ? 'qst-targeted' : 'qst',
            'backoffice-safe': 'backoffice',
            'allure-smoke': 'allure-smoke'
          ][params.TEST_SUITE]
          def marketLower = params.MARKET.toLowerCase()
          def artifactDir = params.TEST_SUITE == 'allure-smoke'
            ? 'test-results/reporter-tests/allure-smoke'
            : "test-results/jenkins/${marketLower}-${suiteFolder}"

          env.JENKINS_SUITE_LABEL = suiteLabel
          env.JENKINS_ARTIFACT_DIR = artifactDir
          env.MX_JENKINS_ARTIFACT_DIR = artifactDir
          env.MX_QST_ARTIFACT_DIR = artifactDir
          env.PE_QST_ARTIFACT_DIR = artifactDir
          env.PW_VIDEO = params.EVIDENCE_MODE == 'screenshots-trace-video' ? '1' : '0'
          env.TEST_MARKET = params.MARKET
          env.MARKET = params.MARKET
          env.MX_QST_ENVIRONMENT = params.ENVIRONMENT
          env.PE_QST_ENVIRONMENT = params.ENVIRONMENT
          env.BACKOFFICE_ENV = params.ENVIRONMENT.toLowerCase()
          env.MX_QST_HEADLESS = params.BROWSER_MODE == 'headless' ? '1' : '0'
          env.MX_QST_TARGET_IDS = params.P1_TARGET_IDS?.trim() ?: ''
          env.PE_STOREFRONT_URL = params.ENVIRONMENT == 'S2' ? 'https://stg2.shop.samsung.com/pe/' : 'https://stg.shop.samsung.com/pe/'

          // Keep Playwright browsers outside node_modules so npm ci does not
          // force a ~300 MB Chromium/FFmpeg download on every Jenkins build.
          // First build seeds the cache; following builds reuse it.
          env.PLAYWRIGHT_BROWSERS_PATH = isUnix()
            ? "${env.HOME}/.cache/ms-playwright"
            : "${env.JENKINS_HOME}\\playwright-browsers"

          currentBuild.displayName = "#${env.BUILD_NUMBER} · ${params.MARKET} · ${params.ENVIRONMENT} · ${suiteLabel}"
          currentBuild.description = "RUNNING | Samsung SMB | ${params.MARKET} ${params.ENVIRONMENT} | ${suiteLabel} | ${params.EXECUTION_MODE} | ${params.BROWSER_MODE}"

          echo '''
============================================================
 SAMSUNG SMB · REGIONAL QUALITY ENGINEERING
============================================================'''
          echo " Market      : ${params.MARKET}"
          echo " Environment : ${params.ENVIRONMENT}"
          echo " Suite       : ${suiteLabel}"
          if (targetedIds) echo " Target IDs  : ${targetedIds.join(', ')}"
          echo " Mode        : ${params.EXECUTION_MODE}"
          echo " Browser     : ${params.BROWSER_MODE}"
          echo " Evidence    : ${params.EVIDENCE_MODE}"
          echo " Reports     : Executive Dashboard · Playwright · Allure"
          echo " Build       : #${env.BUILD_NUMBER}"
          echo '============================================================'
        }
      }
    }

    stage('02 · Checkout') {
      steps { checkout scm }
    }

    stage('03 · Validate Request') {
      steps {
        script {
          if (!['MX', 'PE', 'CL', 'CO'].contains(params.MARKET)) {
            error('Unsupported market. Select MX, PE, CL or CO.')
          }
          if (!['S1', 'S2'].contains(params.ENVIRONMENT)) {
            error('Unsupported environment. Select S1 or S2.')
          }
          if (['CL', 'CO'].contains(params.MARKET)) {
            error("${params.MARKET} is exposed as a regional roadmap target but is not runtime-enabled yet. Stabilize PE first, then enable ${params.MARKET}.")
          }
          if (params.MARKET == 'PE' && params.ENVIRONMENT != 'S2') {
            error('PE phase 1 is intentionally limited to S2/STG2 while the existing PE QST automation is stabilized.')
          }
          if (params.MARKET == 'PE' && params.TEST_SUITE != 'official-p1') {
            error('PE phase 1 currently exposes the coverage-aware official-p1 stabilization lane only. FAST/AUTH/BACKOFFICE lanes will be enabled after PE S2 credentials and runtime baselines are proven.')
          }
          if (params.P1_TARGET_IDS?.trim() && (params.MARKET != 'MX' || params.TEST_SUITE != 'official-p1')) {
            error('P1_TARGET_IDS is supported only for MX official-p1. Clear the field for other suites/markets.')
          }
          if (params.TEST_SUITE == 'official-p1' && params.EXECUTION_MODE != 'authorized-destructive') {
            error("${params.MARKET} official P1 contains payment/order scenarios. Select EXECUTION_MODE=authorized-destructive for the campaign.")
          }
          echo "Validated request: ${params.MARKET} ${params.ENVIRONMENT} · ${params.TEST_SUITE} · ${params.EXECUTION_MODE}"
        }
      }
    }

    stage('04 · Agent Health') {
      steps {
        script {
          if (isUnix()) {
            sh 'node --version && npm --version && git --version'
            sh 'google-chrome --version || chromium --version || true'
          } else {
            bat '@node --version && npm --version && git --version'
            bat '@where chrome 2>nul || where msedge 2>nul || exit /b 0'
          }
        }
      }
    }

    stage('05 · Dependencies') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm ci'
            sh 'npm run reporting:allure:install'
          } else {
            bat '@npm ci'
            bat '@npm run reporting:allure:install'
            bat '@call npx playwright install chromium'
          }
        }
      }
    }

    stage('06 · Official Coverage Gate') {
      when { expression { return params.TEST_SUITE != 'allure-smoke' } }
      steps {
        script {
          if (isUnix()) {
            sh 'npm run qst:official:gate'
            if (params.MARKET == 'MX') sh 'npm run qst:mx:list'
            else if (params.MARKET == 'PE') sh 'node scripts/run-pe-qst-p1.cjs --list'
          } else {
            bat '@npm run qst:official:gate'
            if (params.MARKET == 'MX') bat '@npm run qst:mx:list'
            else if (params.MARKET == 'PE') bat '@call node scripts/run-pe-qst-p1.cjs --list'
          }
        }
      }
    }

    stage('07 · Allure Smoke') {
      when { expression { return params.TEST_SUITE == 'allure-smoke' } }
      steps {
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          script {
            if (isUnix()) sh 'npx -y node@22 scripts/run-allure-smoke.cjs'
            else bat '@call npx -y node@22 scripts/run-allure-smoke.cjs'
          }
        }
      }
    }

    stage('07 · Fast Guest · Safe') {
      when { expression { return params.MARKET == 'MX' && params.TEST_SUITE == 'fast-guest' } }
      steps {
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          script {
            env.MX_FAST_ARTIFACT_DIR = env.JENKINS_ARTIFACT_DIR
            env.TEST_SUITE = 'FAST/GUEST'
            env.TEST_STORE = 'BASE_STORE'
            if (isUnix()) sh 'npx -y node@22 scripts/run-mx-qst-fast-guest.cjs'
            else bat '@call npx -y node@22 scripts/run-mx-qst-fast-guest.cjs'
          }
        }
      }
    }

    stage('07 · Authenticated · Safe') {
      when { expression { return params.MARKET == 'MX' && params.TEST_SUITE == 'authenticated-safe' } }
      steps {
        script {
          env.MX_AUTH_STATE_CREDENTIAL = params.ENVIRONMENT == 'S2' ? 'samsung-mx-s2-auth-state' : 'samsung-mx-s1-auth-state'
          env.MX_SESSION_CREDENTIAL = params.ENVIRONMENT == 'S2' ? 'samsung-mx-s2-session-storage' : 'samsung-mx-s1-session-storage'
          env.MX_AUTH_SUFFIX = params.ENVIRONMENT.toLowerCase()
          env.TEST_SUITE = 'AUTH/REGISTERED'
          env.TEST_STORE = 'BASE_STORE'
          env.PLAYWRIGHT_HTML_OUTPUT_DIR = "${env.JENKINS_ARTIFACT_DIR}/playwright-report"
          env.PLAYWRIGHT_JSON_OUTPUT_FILE = "${env.JENKINS_ARTIFACT_DIR}/results.json"
          env.ALLURE_RESULTS_DIR = "${env.JENKINS_ARTIFACT_DIR}/allure-results"
          env.SMB_EVIDENCE_DIR = "${env.JENKINS_ARTIFACT_DIR}/evidence"
        }
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          withCredentials([
            file(credentialsId: env.MX_AUTH_STATE_CREDENTIAL, variable: 'MX_AUTH_STATE_SECRET'),
            file(credentialsId: env.MX_SESSION_CREDENTIAL, variable: 'MX_SESSION_STORAGE_SECRET')
          ]) {
            script {
              if (isUnix()) {
                sh '''
                  set -eu
                  mkdir -p playwright/.auth
                  cp "$MX_AUTH_STATE_SECRET" playwright/.auth/mx-${MX_AUTH_SUFFIX}-user.json
                  cp "$MX_SESSION_STORAGE_SECRET" playwright/.auth/mx-${MX_AUTH_SUFFIX}-session-storage.json
                  chmod 600 playwright/.auth/mx-${MX_AUTH_SUFFIX}-user.json playwright/.auth/mx-${MX_AUTH_SUFFIX}-session-storage.json || true
                  EXTRA=""
                  if [ "${BROWSER_MODE}" = "headed" ]; then EXTRA="--headed"; fi
                  npx playwright test tests/s1/mx/qst/base-store/authenticated-safe.spec.js --project=chromium --workers=1 --retries=0 --output "$JENKINS_ARTIFACT_DIR/playwright" $EXTRA
                '''
              } else {
                bat '''@echo off
                  if not exist playwright\\.auth mkdir playwright\\.auth
                  copy /Y "%MX_AUTH_STATE_SECRET%" "playwright\\.auth\\mx-%MX_AUTH_SUFFIX%-user.json" >nul || exit /b 2
                  copy /Y "%MX_SESSION_STORAGE_SECRET%" "playwright\\.auth\\mx-%MX_AUTH_SUFFIX%-session-storage.json" >nul || exit /b 2
                  if /I "%BROWSER_MODE%"=="headed" (
                    call npx playwright test tests/s1/mx/qst/base-store/authenticated-safe.spec.js --project=chromium --workers=1 --retries=0 --output "%JENKINS_ARTIFACT_DIR%\\playwright" --headed
                  ) else (
                    call npx playwright test tests/s1/mx/qst/base-store/authenticated-safe.spec.js --project=chromium --workers=1 --retries=0 --output "%JENKINS_ARTIFACT_DIR%\\playwright"
                  )
                '''
              }
            }
          }
        }
      }
    }

    stage('07 · BackOffice · Safe') {
      when { expression { return params.MARKET == 'MX' && params.TEST_SUITE == 'backoffice-safe' } }
      steps {
        script {
          env.TEST_SUITE = 'BACKOFFICE/SAFE'
          env.TEST_STORE = 'BACKOFFICE'
          env.PLAYWRIGHT_HTML_OUTPUT_DIR = "${env.JENKINS_ARTIFACT_DIR}/playwright-report"
          env.PLAYWRIGHT_JSON_OUTPUT_FILE = "${env.JENKINS_ARTIFACT_DIR}/results.json"
          env.ALLURE_RESULTS_DIR = "${env.JENKINS_ARTIFACT_DIR}/allure-results"
          env.SMB_EVIDENCE_DIR = "${env.JENKINS_ARTIFACT_DIR}/evidence"
        }
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          script {
            if (params.ENVIRONMENT == 'S2') {
              withCredentials([
                file(credentialsId: 'samsung-mx-s2-backoffice-admin', variable: 'MX_BACKOFFICE_ADMIN_SECRET')
              ]) {
                if (isUnix()) {
                  sh '''
                    set -eu
                    mkdir -p playwright/.auth
                    cp "$MX_BACKOFFICE_ADMIN_SECRET" playwright/.auth/backoffice-admin-s2.json
                    chmod 600 playwright/.auth/backoffice-admin-s2.json || true
                    npx playwright test tests/s1/smb/qst/backoffice --project=chromium --workers=1 --retries=0 --grep-invert @destructive --output "$JENKINS_ARTIFACT_DIR/playwright"
                  '''
                } else {
                  bat '''@echo off
                    if not exist playwright\\.auth mkdir playwright\\.auth
                    copy /Y "%MX_BACKOFFICE_ADMIN_SECRET%" "playwright\\.auth\\backoffice-admin-s2.json" >nul || exit /b 2
                    call npx playwright test tests/s1/smb/qst/backoffice --project=chromium --workers=1 --retries=0 --grep-invert @destructive --output "%JENKINS_ARTIFACT_DIR%\\playwright"
                  '''
                }
              }
            } else {
              if (isUnix()) sh 'npx playwright test tests/s1/smb/qst/backoffice --project=chromium --workers=1 --retries=0 --grep-invert @destructive --output "$JENKINS_ARTIFACT_DIR/playwright"'
              else bat '@call npx playwright test tests/s1/smb/qst/backoffice --project=chromium --workers=1 --retries=0 --grep-invert @destructive --output "%JENKINS_ARTIFACT_DIR%\\playwright"'
            }
          }
        }
      }
    }

    stage('07 · Official P1') {
      when { expression { return params.TEST_SUITE == 'official-p1' } }
      steps {
        script {
          env.TEST_SUITE = 'P1/QST'
          env.TEST_STORE = 'BASE_STORE'
        }
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          script {
            if (params.MARKET == 'PE') {
              if (isUnix()) sh 'npx -y node@22 scripts/run-pe-qst-p1.cjs'
              else bat '@call npx -y node@22 scripts/run-pe-qst-p1.cjs'
            } else {
              env.MX_AUTH_STATE_CREDENTIAL = params.ENVIRONMENT == 'S2' ? 'samsung-mx-s2-auth-state' : 'samsung-mx-s1-auth-state'
              env.MX_SESSION_CREDENTIAL = params.ENVIRONMENT == 'S2' ? 'samsung-mx-s2-session-storage' : 'samsung-mx-s1-session-storage'
              env.MX_AUTH_SUFFIX = params.ENVIRONMENT.toLowerCase()

              if (params.ENVIRONMENT == 'S2') {
                withCredentials([
                  file(credentialsId: env.MX_AUTH_STATE_CREDENTIAL, variable: 'MX_AUTH_STATE_SECRET'),
                  file(credentialsId: env.MX_SESSION_CREDENTIAL, variable: 'MX_SESSION_STORAGE_SECRET'),
                  file(credentialsId: 'samsung-mx-s2-second-auth-state', variable: 'MX_SECOND_AUTH_STATE_SECRET'),
                  file(credentialsId: 'samsung-mx-s2-second-session-storage', variable: 'MX_SECOND_SESSION_STORAGE_SECRET'),
                  file(credentialsId: 'samsung-mx-test-card', variable: 'MX_TEST_CARD_SECRET'),
                  file(credentialsId: 'samsung-mx-s2-backoffice-admin', variable: 'MX_BACKOFFICE_ADMIN_SECRET')
                ]) {
                  if (isUnix()) {
                    sh '''
                      set -eu
                      mkdir -p playwright/.auth
                      cp "$MX_AUTH_STATE_SECRET" playwright/.auth/mx-${MX_AUTH_SUFFIX}-user.json
                      cp "$MX_SESSION_STORAGE_SECRET" playwright/.auth/mx-${MX_AUTH_SUFFIX}-session-storage.json
                      cp "$MX_SECOND_AUTH_STATE_SECRET" playwright/.auth/mx-${MX_AUTH_SUFFIX}-second-user.json
                      cp "$MX_SECOND_SESSION_STORAGE_SECRET" playwright/.auth/mx-${MX_AUTH_SUFFIX}-second-session-storage.json
                      cp "$MX_TEST_CARD_SECRET" playwright/.auth/mx-test-card.json
                      cp "$MX_BACKOFFICE_ADMIN_SECRET" playwright/.auth/backoffice-admin-s2.json
                      chmod 600 playwright/.auth/*.json || true
                      npx -y node@22 scripts/run-mx-qst-safe.cjs
                    '''
                  } else {
                    bat '''@echo off
                      if not exist playwright\\.auth mkdir playwright\\.auth
                      copy /Y "%MX_AUTH_STATE_SECRET%" "playwright\\.auth\\mx-%MX_AUTH_SUFFIX%-user.json" >nul || exit /b 2
                      copy /Y "%MX_SESSION_STORAGE_SECRET%" "playwright\\.auth\\mx-%MX_AUTH_SUFFIX%-session-storage.json" >nul || exit /b 2
                      copy /Y "%MX_SECOND_AUTH_STATE_SECRET%" "playwright\\.auth\\mx-%MX_AUTH_SUFFIX%-second-user.json" >nul || exit /b 2
                      copy /Y "%MX_SECOND_SESSION_STORAGE_SECRET%" "playwright\\.auth\\mx-%MX_AUTH_SUFFIX%-second-session-storage.json" >nul || exit /b 2
                      copy /Y "%MX_TEST_CARD_SECRET%" "playwright\\.auth\\mx-test-card.json" >nul || exit /b 2
                      copy /Y "%MX_BACKOFFICE_ADMIN_SECRET%" "playwright\\.auth\\backoffice-admin-s2.json" >nul || exit /b 2
                      call npx -y node@22 scripts/run-mx-qst-safe.cjs
                    '''
                  }
                }
              } else {
                withCredentials([
                  file(credentialsId: env.MX_AUTH_STATE_CREDENTIAL, variable: 'MX_AUTH_STATE_SECRET'),
                  file(credentialsId: env.MX_SESSION_CREDENTIAL, variable: 'MX_SESSION_STORAGE_SECRET'),
                  file(credentialsId: 'samsung-mx-test-card', variable: 'MX_TEST_CARD_SECRET')
                ]) {
                  if (isUnix()) {
                    sh '''
                      set -eu
                      mkdir -p playwright/.auth
                      cp "$MX_AUTH_STATE_SECRET" playwright/.auth/mx-${MX_AUTH_SUFFIX}-user.json
                      cp "$MX_SESSION_STORAGE_SECRET" playwright/.auth/mx-${MX_AUTH_SUFFIX}-session-storage.json
                      cp "$MX_TEST_CARD_SECRET" playwright/.auth/mx-test-card.json
                      chmod 600 playwright/.auth/*.json || true
                      npx -y node@22 scripts/run-mx-qst-safe.cjs
                    '''
                  } else {
                    bat '''@echo off
                      if not exist playwright\\.auth mkdir playwright\\.auth
                      copy /Y "%MX_AUTH_STATE_SECRET%" "playwright\\.auth\\mx-%MX_AUTH_SUFFIX%-user.json" >nul || exit /b 2
                      copy /Y "%MX_SESSION_STORAGE_SECRET%" "playwright\\.auth\\mx-%MX_AUTH_SUFFIX%-session-storage.json" >nul || exit /b 2
                      copy /Y "%MX_TEST_CARD_SECRET%" "playwright\\.auth\\mx-test-card.json" >nul || exit /b 2
                      call npx -y node@22 scripts/run-mx-qst-safe.cjs
                    '''
                  }
                }
              }
            }
          }
        }
      }
    }

    stage('08 · Finalize Reports') {
      when { expression { return params.TEST_SUITE != 'allure-smoke' } }
      steps {
        script {
          def resultsPath = "${env.JENKINS_ARTIFACT_DIR}/allure-results"
          if (params.MARKET == 'MX' && ['official-p1', 'fast-guest'].contains(params.TEST_SUITE)) {
            env.ALLURE_REPORT_NAME = "Samsung ${params.MARKET} ${params.ENVIRONMENT} ${env.JENKINS_SUITE_LABEL} - Allure"
            if (isUnix()) sh 'npx -y node@22 scripts/finalize-allure-mx-qst.cjs || true'
            else bat '@call npx -y node@22 scripts/finalize-allure-mx-qst.cjs || exit /b 0'
          } else {
            if (isUnix()) sh 'npx -y node@22 scripts/finalize-jenkins-suite.cjs || true'
            else bat '@call npx -y node@22 scripts/finalize-jenkins-suite.cjs || exit /b 0'
          }

          try {
            allure includeProperties: false, jdk: '', results: [[path: resultsPath]]
            env.NATIVE_ALLURE_PUBLISHED = '1'
            echo "Native Allure history published from ${resultsPath}."
          } catch (err) {
            env.NATIVE_ALLURE_PUBLISHED = '0'
            echo "Native Allure publisher unavailable; HTML fallback will be used. ${err}"
          }
        }
      }
    }

    stage('09 · Quality Summary') {
      steps {
        script {
          def suiteLabel = env.JENKINS_SUITE_LABEL ?: params.TEST_SUITE.toUpperCase()
          echo '============================================================'
          echo ' SAMSUNG SMB · REGIONAL QUALITY SUMMARY'
          echo '============================================================'
          echo " RESULT       : ${currentBuild.currentResult}"
          echo " MARKET       : ${params.MARKET}"
          echo " ENVIRONMENT  : ${params.ENVIRONMENT}"
          echo " SUITE        : ${suiteLabel}"
          echo " BUILD        : #${env.BUILD_NUMBER}"
          echo " REPORTS      : Executive Dashboard · Playwright · Allure"
          echo '============================================================'
        }
      }
    }
  }

  post {
    always {
      script {
        if (isUnix()) sh 'rm -rf playwright/.auth || true'
        else bat '@if exist playwright\\.auth rmdir /S /Q playwright\\.auth'
      }

      archiveArtifacts artifacts: 'test-results/**/*, playwright-report/**/*', allowEmptyArchive: true, fingerprint: true

      script {
        if (params.TEST_SUITE == 'allure-smoke') {
          publishHTML(target: [
            allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
            reportDir: 'test-results/reporter-tests/allure-smoke/allure-report',
            reportFiles: 'index.html',
            reportName: 'Samsung Reporting · Allure Smoke'
          ])
        } else {
          publishHTML(target: [
            allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
            reportDir: "${env.JENKINS_ARTIFACT_DIR}/executive",
            reportFiles: 'index.html',
            reportName: "01 · Samsung ${params.MARKET} ${params.ENVIRONMENT} ${env.JENKINS_SUITE_LABEL} · Executive Dashboard"
          ])
          publishHTML(target: [
            allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
            reportDir: params.MARKET == 'MX' && params.TEST_SUITE == 'official-p1' ? 'playwright-report' : "${env.JENKINS_ARTIFACT_DIR}/playwright-report",
            reportFiles: 'index.html',
            reportName: "02 · Samsung ${params.MARKET} ${params.ENVIRONMENT} ${env.JENKINS_SUITE_LABEL} · Playwright"
          ])
          if (env.NATIVE_ALLURE_PUBLISHED != '1') {
            publishHTML(target: [
              allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
              reportDir: "${env.JENKINS_ARTIFACT_DIR}/allure-report",
              reportFiles: 'index.html',
              reportName: "03 · Samsung ${params.MARKET} ${params.ENVIRONMENT} ${env.JENKINS_SUITE_LABEL} · Allure HTML"
            ])
          }
        }
      }
    }

    success {
      script {
        def suiteLabel = env.JENKINS_SUITE_LABEL ?: params.TEST_SUITE.toUpperCase()
        currentBuild.displayName = "#${env.BUILD_NUMBER} · ${params.MARKET} · ${params.ENVIRONMENT} · ${suiteLabel} · PASS"
        currentBuild.description = "PASS | Samsung SMB | ${params.MARKET} ${params.ENVIRONMENT} | ${suiteLabel} | ${params.EXECUTION_MODE} | ${params.BROWSER_MODE}"
        echo 'PASS · Samsung SMB automation build completed successfully.'
      }
    }

    unsuccessful {
      script {
        def suiteLabel = env.JENKINS_SUITE_LABEL ?: params.TEST_SUITE.toUpperCase()
        currentBuild.displayName = "#${env.BUILD_NUMBER} · ${params.MARKET} · ${params.ENVIRONMENT} · ${suiteLabel} · ${currentBuild.currentResult}"
        currentBuild.description = "${currentBuild.currentResult} | Samsung SMB | ${params.MARKET} ${params.ENVIRONMENT} | ${suiteLabel} | Review Executive Dashboard / Playwright / Allure"
        echo "${currentBuild.currentResult} · Samsung SMB automation build did not complete successfully. Review the Executive Dashboard and archived Playwright/Allure evidence."
      }
    }
  }
}