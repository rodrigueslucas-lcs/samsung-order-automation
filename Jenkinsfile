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
    choice(name: 'TEST_SUITE', choices: ['fast-guest', 'official-p1', 'backoffice-safe', 'allure-smoke'], description: 'Execution profile. fast-guest = quick feedback; official-p1 = official MX P1 campaign; backoffice-safe = read-only BackOffice coverage.')
    choice(name: 'EXECUTION_MODE', choices: ['safe', 'authorized-destructive'], description: 'Safety mode. Full official-p1 payment/order execution requires authorized-destructive.')
    choice(name: 'BROWSER_MODE', choices: ['headless', 'headed'], description: 'Browser mode. Headless is recommended on Jenkins.')
    choice(name: 'EVIDENCE_MODE', choices: ['screenshots-trace', 'screenshots-trace-video'], description: 'Evidence capture. Video requires FFmpeg on the Jenkins agent.')
  }

  environment {
    CI = '1'
    MX_QST_ARTIFACT_DIR = 'test-results/jenkins/mx-qst'
    MX_QST_USE_EXISTING_AUTH = '1'
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
            'official-p1': 'P1 · 30 TCs',
            'backoffice-safe': 'BACKOFFICE',
            'allure-smoke': 'ALLURE SMOKE'
          ][params.TEST_SUITE] ?: params.TEST_SUITE.toUpperCase()

          env.JENKINS_SUITE_LABEL = suiteLabel
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
            env.PW_VIDEO = params.EVIDENCE_MODE == 'screenshots-trace-video' ? '1' : '0'
            env.MX_QST_ENVIRONMENT = params.ENVIRONMENT
            env.BACKOFFICE_ENV = params.ENVIRONMENT.toLowerCase()
            env.MX_QST_HEADLESS = params.BROWSER_MODE == 'headless' ? '1' : '0'
            env.ENABLE_ALLURE = '1'
            env.MX_FAST_ARTIFACT_DIR = 'test-results/jenkins/mx-fast'
            env.MX_QST_ARTIFACT_DIR = 'test-results/jenkins/mx-fast'
            env.TEST_SUITE = 'FAST/GUEST'
            if (isUnix()) sh 'npx -y node@22 scripts/run-mx-qst-fast-guest.cjs'
            else bat '@call npx -y node@22 scripts/run-mx-qst-fast-guest.cjs'
          }
        }
      }
    }

    stage('07 · BackOffice · Safe') {
      when { expression { return params.TEST_SUITE == 'backoffice-safe' } }
      steps {
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          script {
            env.PW_VIDEO = params.EVIDENCE_MODE == 'screenshots-trace-video' ? '1' : '0'
            env.MX_QST_ENVIRONMENT = params.ENVIRONMENT
            env.BACKOFFICE_ENV = params.ENVIRONMENT.toLowerCase()
            env.MX_QST_HEADLESS = params.BROWSER_MODE == 'headless' ? '1' : '0'
            if (isUnix()) sh 'npm run qst:smb:backoffice -- --grep-invert @destructive'
            else bat '@npm run qst:smb:backoffice -- --grep-invert @destructive'
          }
        }
      }
    }

    stage('07 · Official P1 · 30 TCs') {
      when { expression { return params.TEST_SUITE == 'official-p1' } }
      steps {
        script {
          env.PW_VIDEO = params.EVIDENCE_MODE == 'screenshots-trace-video' ? '1' : '0'
          env.MX_QST_ENVIRONMENT = params.ENVIRONMENT
          env.BACKOFFICE_ENV = params.ENVIRONMENT.toLowerCase()
          env.MX_QST_HEADLESS = params.BROWSER_MODE == 'headless' ? '1' : '0'
          env.MX_AUTH_STATE_CREDENTIAL = params.ENVIRONMENT == 'S2' ? 'samsung-mx-s2-auth-state' : 'samsung-mx-s1-auth-state'
          env.MX_SESSION_CREDENTIAL = params.ENVIRONMENT == 'S2' ? 'samsung-mx-s2-session-storage' : 'samsung-mx-s1-session-storage'
          env.MX_AUTH_SUFFIX = params.ENVIRONMENT.toLowerCase()
        }
        catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
          withCredentials([
            file(credentialsId: env.MX_AUTH_STATE_CREDENTIAL, variable: 'MX_AUTH_STATE_SECRET'),
            file(credentialsId: env.MX_SESSION_CREDENTIAL, variable: 'MX_SESSION_STORAGE_SECRET'),
            file(credentialsId: 'samsung-mx-test-card', variable: 'MX_TEST_CARD_SECRET')
          ]) {
            script {
              if (isUnix()) {
                sh '''
                  set -eu
                  mkdir -p playwright/.auth
                  cp "$MX_AUTH_STATE_SECRET" playwright/.auth/mx-${MX_AUTH_SUFFIX}-user.json
                  cp "$MX_SESSION_STORAGE_SECRET" playwright/.auth/mx-${MX_AUTH_SUFFIX}-session-storage.json
                  cp "$MX_TEST_CARD_SECRET" playwright/.auth/mx-test-card.json
                  chmod 600 playwright/.auth/mx-${MX_AUTH_SUFFIX}-user.json playwright/.auth/mx-${MX_AUTH_SUFFIX}-session-storage.json playwright/.auth/mx-test-card.json || true
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

    stage('08 · Finalize Reports') {
      when { expression { return ['fast-guest', 'official-p1'].contains(params.TEST_SUITE) } }
      steps {
        script {
          def resultsPath
          if (params.TEST_SUITE == 'official-p1') {
            env.ALLURE_REPORT_NAME = "Samsung MX ${params.ENVIRONMENT} QST - Allure"
            env.MX_QST_ENVIRONMENT = params.ENVIRONMENT
            resultsPath = 'test-results/jenkins/mx-qst/allure-results'
            if (isUnix()) sh 'npx -y node@22 scripts/finalize-allure-mx-qst.cjs || true'
            else bat '@call npx -y node@22 scripts/finalize-allure-mx-qst.cjs || exit /b 0'
          } else {
            resultsPath = 'test-results/jenkins/mx-fast/allure-results'
            withEnv([
              "ALLURE_REPORT_NAME=Samsung MX ${params.ENVIRONMENT} Fast - Allure",
              "MX_QST_ENVIRONMENT=${params.ENVIRONMENT}",
              'MX_QST_ARTIFACT_DIR=test-results/jenkins/mx-fast',
              'TEST_SUITE=FAST/GUEST'
            ]) {
              if (isUnix()) sh 'npx -y node@22 scripts/finalize-allure-mx-qst.cjs || true'
              else bat '@call npx -y node@22 scripts/finalize-allure-mx-qst.cjs || exit /b 0'
            }
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
        if (params.TEST_SUITE == 'fast-guest') {
          publishHTML(target: [
            allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
            reportDir: 'test-results/jenkins/mx-fast/executive',
            reportFiles: 'index.html',
            reportName: "01 · Samsung MX ${params.ENVIRONMENT} Fast · Executive Dashboard"
          ])
          publishHTML(target: [
            allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
            reportDir: 'test-results/jenkins/mx-fast/playwright-report',
            reportFiles: 'index.html',
            reportName: "02 · Samsung MX ${params.ENVIRONMENT} Fast · Playwright"
          ])
          if (env.NATIVE_ALLURE_PUBLISHED != '1') {
            publishHTML(target: [
              allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
              reportDir: 'test-results/jenkins/mx-fast/allure-report',
              reportFiles: 'index.html',
              reportName: "03 · Samsung MX ${params.ENVIRONMENT} Fast · Allure HTML"
            ])
          }
        } else if (params.TEST_SUITE == 'official-p1') {
          publishHTML(target: [
            allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
            reportDir: 'test-results/jenkins/mx-qst/executive',
            reportFiles: 'index.html',
            reportName: "01 · Samsung MX ${params.ENVIRONMENT} P1 · Executive Dashboard"
          ])
          publishHTML(target: [
            allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
            reportDir: 'playwright-report',
            reportFiles: 'index.html',
            reportName: "02 · Samsung MX ${params.ENVIRONMENT} P1 · Playwright"
          ])
          if (env.NATIVE_ALLURE_PUBLISHED != '1') {
            publishHTML(target: [
              allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
              reportDir: 'test-results/jenkins/mx-qst/allure-report',
              reportFiles: 'index.html',
              reportName: "03 · Samsung MX ${params.ENVIRONMENT} P1 · Allure HTML"
            ])
          }
        } else if (params.TEST_SUITE == 'allure-smoke') {
          publishHTML(target: [
            allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true,
            reportDir: 'test-results/reporter-tests/allure-smoke/allure-report',
            reportFiles: 'index.html',
            reportName: 'Samsung Reporting · Allure Smoke'
          ])
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
