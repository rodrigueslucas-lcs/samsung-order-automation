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
    choice(name: 'ENVIRONMENT', choices: ['S1', 'S2'], description: 'Target MX environment. S1 = stg storefront / S1 BackOffice; S2 = stg2 storefront / S2 BackOffice.')
    choice(name: 'TEST_SUITE', choices: ['fast-guest', 'authenticated-safe', 'official-p1', 'backoffice-safe', 'allure-smoke'], description: 'Execution profile. Functional suites use the same Executive Dashboard + Playwright + Allure reporting standard.')
    choice(name: 'EXECUTION_MODE', choices: ['safe', 'authorized-destructive'], description: 'Safety mode. Full official-p1 payment/order execution requires authorized-destructive.')
    choice(name: 'BROWSER_MODE', choices: ['headless', 'headed'], description: 'Browser mode. Headless is recommended on Jenkins.')
    choice(name: 'EVIDENCE_MODE', choices: ['screenshots-trace', 'screenshots-trace-video'], description: 'Evidence capture. Video requires FFmpeg on the Jenkins agent.')
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
          def suiteLabel = [
            'fast-guest': 'FAST',
            'authenticated-safe': 'AUTH SAFE',
            'official-p1': 'P1 · 30 TCs',
            'backoffice-safe': 'BACKOFFICE',
            'allure-smoke': 'ALLURE SMOKE'
          ][params.TEST_SUITE] ?: params.TEST_SUITE.toUpperCase()
          def artifactDir = [
            'fast-guest': 'test-results/jenkins/mx-fast',
            'authenticated-safe': 'test-results/jenkins/mx-auth',
            'official-p1': 'test-results/jenkins/mx-qst',
            'backoffice-safe': 'test-results/jenkins/mx-backoffice',
            'allure-smoke': 'test-results/reporter-tests/allure-smoke'
          ][params.TEST_SUITE]

          env.JENKINS_SUITE_LABEL = suiteLabel
          env.MX_JENKINS_ARTIFACT_DIR = artifactDir
          env.MX_QST_ARTIFACT_DIR = artifactDir
          env.PW_VIDEO = params.EVIDENCE_MODE == 'screenshots-trace-video' ? '1' : '0'
          env.MX_QST_ENVIRONMENT = params.ENVIRONMENT
          env.BACKOFFICE_ENV = params.ENVIRONMENT.toLowerCase()
          env.MX_QST_HEADLESS = params.BROWSER_MODE == 'headless' ? '1' : '0'

          currentBuild.displayName = "#${env.BUILD_NUMBER} · MX · ${params.ENVIRONMENT} · ${suiteLabel}"
          currentBuild.description = "RUNNING | Samsung SMB | MX ${params.ENVIRONMENT} | ${suiteLabel} | ${params.EXECUTION_MODE} | ${params.BROWSER_MODE}"

          echo '''
============================================================
 SAMSUNG SMB · QUALITY ENGINEERING · MX
============================================================'''
          echo " Environment : ${params.ENVIRONMENT}"
          echo " Suite       : ${suiteLabel}"
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
          if (!['S1', 'S2'].contains(params.ENVIRONMENT)) {
            error('Unsupported MX environment. Select S1 or S2.')
          }
          if (params.TEST_SUITE == 'official-p1' && params.EXECUTION_MODE != 'authorized-destructive') {
            error('Official MX QST contains authorized payment/order P1 scenarios. Select EXECUTION_MODE=authorized-destructive for the full 30-TC campaign.')
          }
          echo "Validated request: MX ${params.ENVIRONMENT} · ${params.TEST_SUITE} · ${params.EXECUTION_MODE}"
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
            sh 'npm run qst:mx:list'
          } else {
            bat '@npm run qst:official:gate'
            bat '@npm run qst:mx:list'
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
      when { expression { return params.TEST_SUITE == 'fast-guest' } }
      steps {
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          script {
            env.MX_FAST_ARTIFACT_DIR = env.MX_JENKINS_ARTIFACT_DIR
            env.TEST_SUITE = 'FAST/GUEST'
            env.TEST_STORE = 'BASE_STORE'
            if (isUnix()) sh 'npx -y node@22 scripts/run-mx-qst-fast-guest.cjs'
            else bat '@call npx -y node@22 scripts/run-mx-qst-fast-guest.cjs'
          }
        }
      }
    }

    stage('07 · Authenticated · Safe') {
      when { expression { return params.TEST_SUITE == 'authenticated-safe' } }
      steps {
        script {
          env.MX_AUTH_STATE_CREDENTIAL = params.ENVIRONMENT == 'S2' ? 'samsung-mx-s2-auth-state' : 'samsung-mx-s1-auth-state'
          env.MX_SESSION_CREDENTIAL = params.ENVIRONMENT == 'S2' ? 'samsung-mx-s2-session-storage' : 'samsung-mx-s1-session-storage'
          env.MX_AUTH_SUFFIX = params.ENVIRONMENT.toLowerCase()
          env.TEST_SUITE = 'AUTH/REGISTERED'
          env.TEST_STORE = 'BASE_STORE'
          env.PLAYWRIGHT_HTML_OUTPUT_DIR = "${env.MX_JENKINS_ARTIFACT_DIR}/playwright-report"
          env.PLAYWRIGHT_JSON_OUTPUT_FILE = "${env.MX_JENKINS_ARTIFACT_DIR}/results.json"
          env.ALLURE_RESULTS_DIR = "${env.MX_JENKINS_ARTIFACT_DIR}/allure-results"
          env.SMB_EVIDENCE_DIR = "${env.MX_JENKINS_ARTIFACT_DIR}/evidence"
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
                  npx playwright test tests/s1/mx/qst/base-store/authenticated-safe.spec.js --project=chromium --workers=1 --retries=0 --output "$MX_JENKINS_ARTIFACT_DIR/playwright" $EXTRA
                '''
              } else {
                bat '''@echo off
                  if not exist playwright\\.auth mkdir playwright\\.auth
                  copy /Y "%MX_AUTH_STATE_SECRET%" "playwright\\.auth\\mx-%MX_AUTH_SUFFIX%-user.json" >nul || exit /b 2
                  copy /Y "%MX_SESSION_STORAGE_SECRET%" "playwright\\.auth\\mx-%MX_AUTH_SUFFIX%-session-storage.json" >nul || exit /b 2
                  if /I "%BROWSER_MODE%"=="headed" (
                    call npx playwright test tests/s1/mx/qst/base-store/authenticated-safe.spec.js --project=chromium --workers=1 --retries=0 --output "%MX_JENKINS_ARTIFACT_DIR%\\playwright" --headed
                  ) else (
                    call npx playwright test tests/s1/mx/qst/base-store/authenticated-safe.spec.js --project=chromium --workers=1 --retries=0 --output "%MX_JENKINS_ARTIFACT_DIR%\\playwright"
                  )
                '''
              }
            }
          }
        }
      }
    }

    stage('07 · BackOffice · Safe') {
      when { expression { return params.TEST_SUITE == 'backoffice-safe' } }
      steps {
        script {
          env.TEST_SUITE = 'BACKOFFICE/SAFE'
          env.TEST_STORE = 'BACKOFFICE'
          env.PLAYWRIGHT_HTML_OUTPUT_DIR = "${env.MX_JENKINS_ARTIFACT_DIR}/playwright-report"
          env.PLAYWRIGHT_JSON_OUTPUT_FILE = "${env.MX_JENKINS_ARTIFACT_DIR}/results.json"
          env.ALLURE_RESULTS_DIR = "${env.MX_JENKINS_ARTIFACT_DIR}/allure-results"
          env.SMB_EVIDENCE_DIR = "${env.MX_JENKINS_ARTIFACT_DIR}/evidence"
        }
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          script {
            if (isUnix()) {
              sh 'npx playwright test tests/s1/smb/qst/backoffice --project=chromium --workers=1 --retries=0 --grep-invert @destructive --output "$MX_JENKINS_ARTIFACT_DIR/playwright"'
            } else {
              bat '@call npx playwright test tests/s1/smb/qst/backoffice --project=chromium --workers=1 --retries=0 --grep-invert @destructive --output "%MX_JENKINS_ARTIFACT_DIR%\\playwright"'
            }
          }
        }
      }
    }

    stage('07 · Official P1 · 30 TCs') {
      when { expression { return params.TEST_SUITE == 'official-p1' } }
      steps {
        script {
          env.MX_AUTH_STATE_CREDENTIAL = params.ENVIRONMENT == 'S2' ? 'samsung-mx-s2-auth-state' : 'samsung-mx-s1-auth-state'
          env.MX_SESSION_CREDENTIAL = params.ENVIRONMENT == 'S2' ? 'samsung-mx-s2-session-storage' : 'samsung-mx-s1-session-storage'
          env.MX_AUTH_SUFFIX = params.ENVIRONMENT.toLowerCase()
          env.TEST_SUITE = 'P1/QST'
          env.TEST_STORE = 'BASE_STORE'
        }
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          script {
            if (params.ENVIRONMENT == 'S2') {
              withCredentials([
                file(credentialsId: env.MX_AUTH_STATE_CREDENTIAL, variable: 'MX_AUTH_STATE_SECRET'),
                file(credentialsId: env.MX_SESSION_CREDENTIAL, variable: 'MX_SESSION_STORAGE_SECRET'),
                file(credentialsId: 'samsung-mx-s2-second-auth-state', variable: 'MX_SECOND_AUTH_STATE_SECRET'),
                file(credentialsId: 'samsung-mx-s2-second-session-storage', variable: 'MX_SECOND_SESSION_STORAGE_SECRET'),
                file(credentialsId: 'samsung-mx-test-card', variable: 'MX_TEST_CARD_SECRET')
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

    stage('08 · Finalize Reports') {
      when { expression { return params.TEST_SUITE != 'allure-smoke' } }
      steps {
        script {
          def resultsPath = "${env.MX_JENKINS_ARTIFACT_DIR}/allure-results"
          if (params.TEST_SUITE == 'official-p1') {
            env.ALLURE_REPORT_NAME = "Samsung MX ${params.ENVIRONMENT} QST - Allure"
            if (isUnix()) sh 'npx -y node@22 scripts/finalize-allure-mx-qst.cjs || true'
            else bat '@call npx -y node@22 scripts/finalize-allure-mx-qst.cjs || exit /b 0'
          } else if (params.TEST_SUITE == 'fast-guest') {
            env.ALLURE_REPORT_NAME = "Samsung MX ${params.ENVIRONMENT} Fast - Allure"
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
          echo ' SAMSUNG SMB · QUALITY SUMMARY'
          echo '============================================================'
          echo " RESULT       : ${currentBuild.currentResult}"
          echo " ENVIRONMENT  : MX ${params.ENVIRONMENT}"
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
        if (isUnix()) {
          sh 'rm -rf playwright/.auth || true'
        } else {
          bat '@if exist playwright\\.auth rmdir /S /Q playwright\\.auth'
        }
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
            reportDir: "${env.MX_JENKINS_ARTIFACT_DIR}/executive",
            reportFiles: 'index.html',
            reportName: "01 · Samsung MX ${params.ENVIRONMENT} ${env.JENKINS_SUITE_LABEL} · Executive Dashboard"
          ])
          publishHTML(target: [
            allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
            reportDir: params.TEST_SUITE == 'official-p1' ? 'playwright-report' : "${env.MX_JENKINS_ARTIFACT_DIR}/playwright-report",
            reportFiles: 'index.html',
            reportName: "02 · Samsung MX ${params.ENVIRONMENT} ${env.JENKINS_SUITE_LABEL} · Playwright"
          ])
          if (env.NATIVE_ALLURE_PUBLISHED != '1') {
            publishHTML(target: [
              allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
              reportDir: "${env.MX_JENKINS_ARTIFACT_DIR}/allure-report",
              reportFiles: 'index.html',
              reportName: "03 · Samsung MX ${params.ENVIRONMENT} ${env.JENKINS_SUITE_LABEL} · Allure HTML"
            ])
          }
        }
      }
    }

    success {
      script {
        def suiteLabel = env.JENKINS_SUITE_LABEL ?: params.TEST_SUITE.toUpperCase()
        currentBuild.displayName = "#${env.BUILD_NUMBER} · MX · ${params.ENVIRONMENT} · ${suiteLabel} · PASS"
        currentBuild.description = "PASS | Samsung SMB | MX ${params.ENVIRONMENT} | ${suiteLabel} | ${params.EXECUTION_MODE} | ${params.BROWSER_MODE}"
        echo 'PASS · Samsung SMB automation build completed successfully.'
      }
    }

    unsuccessful {
      script {
        def suiteLabel = env.JENKINS_SUITE_LABEL ?: params.TEST_SUITE.toUpperCase()
        currentBuild.displayName = "#${env.BUILD_NUMBER} · MX · ${params.ENVIRONMENT} · ${suiteLabel} · ${currentBuild.currentResult}"
        currentBuild.description = "${currentBuild.currentResult} | Samsung SMB | MX ${params.ENVIRONMENT} | ${suiteLabel} | Review Executive Dashboard / Playwright / Allure"
        echo "${currentBuild.currentResult} · Samsung SMB automation build did not complete successfully. Review the Executive Dashboard and archived Playwright/Allure evidence."
      }
    }
  }
}
