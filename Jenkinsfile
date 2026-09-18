pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '15'))
    timeout(time: 75, unit: 'MINUTES')
    skipDefaultCheckout(true)
  }

  parameters {
    choice(name: 'TEST_SUITE', choices: ['fast-guest', 'official-p1', 'allure-smoke'], description: 'Suite: fast-guest = quick safe MX validation; official-p1 = complete 30-TC MX Base Store P1/QST; allure-smoke = reporting validation only.')
    booleanParam(name: 'RUN_DESTRUCTIVE', defaultValue: false, description: 'Official P1 only: allow authorized payment/order scenarios. Not used by fast-guest.')

    booleanParam(name: 'ENABLE_VIDEO', defaultValue: false, description: 'Enable Playwright video only after FFmpeg is proven on this Jenkins agent.')
    booleanParam(name: 'HEADLESS', defaultValue: true, description: 'Run Playwright headless. Recommended for Jenkins service agents.')
  }

  environment {
    CI = '1'
    MX_QST_ARTIFACT_DIR = 'test-results/jenkins/mx-qst'
    MX_QST_USE_EXISTING_AUTH = '1'
    ENABLE_ALLURE = '1'
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Agent Diagnostics') {
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

    stage('Install') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm ci'
            sh 'npm run reporting:allure:install'
          } else {
            bat '@npm ci'
            bat '@npm run reporting:allure:install'
          }
        }
      }
    }

    stage('Allure Reporting Smoke') {
      when { expression { return params.TEST_SUITE == 'allure-smoke' } }
      steps {
        script {
          if (isUnix()) sh 'npx -y node@22 scripts/run-allure-smoke.cjs'
          else bat '@call npx -y node@22 scripts/run-allure-smoke.cjs'
        }
      }
    }

    stage('Official SMB Gate') {
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

    stage('MX Fast Guest · Safe') {
      when { expression { return params.TEST_SUITE == 'fast-guest' } }
      steps {
        script {
          env.PW_VIDEO = params.ENABLE_VIDEO ? '1' : '0'
          env.MX_QST_HEADLESS = params.HEADLESS ? '1' : '0'
          env.ENABLE_ALLURE = '1'
          env.MX_FAST_ARTIFACT_DIR = 'test-results/jenkins/mx-fast'
          env.TEST_SUITE = 'FAST/GUEST'
          if (isUnix()) sh 'npx -y node@22 scripts/run-mx-qst-fast-guest.cjs'
          else bat '@call npx -y node@22 scripts/run-mx-qst-fast-guest.cjs'
        }
      }
    }

    stage('MX Official P1 · 30 TCs') {
      when { expression { return params.TEST_SUITE == 'official-p1' } }
      steps {
        script {
          if (!params.RUN_DESTRUCTIVE) {
            error('Official MX QST contains authorized payment/order P1 scenarios. RUN_DESTRUCTIVE must be enabled for the full 30-TC campaign.')
          }
          env.PW_VIDEO = params.ENABLE_VIDEO ? '1' : '0'
          env.MX_QST_HEADLESS = params.HEADLESS ? '1' : '0'
        }

        withCredentials([
          file(credentialsId: 'samsung-mx-s1-auth-state', variable: 'MX_AUTH_STATE_SECRET'),
          file(credentialsId: 'samsung-mx-s1-session-storage', variable: 'MX_SESSION_STORAGE_SECRET'),
          file(credentialsId: 'samsung-mx-test-card', variable: 'MX_TEST_CARD_SECRET')
        ]) {
          script {
            if (isUnix()) {
              sh '''
                set -eu
                mkdir -p playwright/.auth
                cp "$MX_AUTH_STATE_SECRET" playwright/.auth/mx-s1-user.json
                cp "$MX_SESSION_STORAGE_SECRET" playwright/.auth/mx-s1-session-storage.json
                cp "$MX_TEST_CARD_SECRET" playwright/.auth/mx-test-card.json
                chmod 600 playwright/.auth/mx-s1-user.json playwright/.auth/mx-s1-session-storage.json playwright/.auth/mx-test-card.json || true
                npx -y node@22 scripts/run-mx-qst-safe.cjs
              '''
            } else {
              bat '''@echo off
                if not exist playwright\\.auth mkdir playwright\\.auth
                copy /Y "%MX_AUTH_STATE_SECRET%" "playwright\\.auth\\mx-s1-user.json" >nul || exit /b 2
                copy /Y "%MX_SESSION_STORAGE_SECRET%" "playwright\\.auth\\mx-s1-session-storage.json" >nul || exit /b 2
                copy /Y "%MX_TEST_CARD_SECRET%" "playwright\\.auth\\mx-test-card.json" >nul || exit /b 2
                call npx -y node@22 scripts/run-mx-qst-safe.cjs
              '''
            }
          }
        }
      }
    }
  }

  post {
    always {
      script {
        // Rebuild the official Allure after runtime reconciliation so the report
        // contains Samsung business metadata, official TC status and blocker categories.
        if (params.TEST_SUITE == 'official-p1') {
          if (isUnix()) sh 'npx -y node@22 scripts/finalize-allure-mx-qst.cjs || true'
          else bat '@call npx -y node@22 scripts/finalize-allure-mx-qst.cjs || exit /b 0'
        }
        if (params.TEST_SUITE == 'fast-guest') {
          env.MX_QST_ARTIFACT_DIR = 'test-results/jenkins/mx-fast'
          env.TEST_SUITE = 'FAST/GUEST'
          if (isUnix()) sh 'npx -y node@22 scripts/finalize-allure-mx-qst.cjs || true'
          else bat '@call npx -y node@22 scripts/finalize-allure-mx-qst.cjs || exit /b 0'
        }
        if (isUnix()) {
          sh 'rm -rf playwright/.auth || true'
        } else {
          bat '@if exist playwright\\.auth rmdir /S /Q playwright\\.auth'
        }
      }
      archiveArtifacts artifacts: 'test-results/**/*, playwright-report/**/*', allowEmptyArchive: true, fingerprint: true
      publishHTML(target: [
        allowMissing: true,
        alwaysLinkToLastBuild: true,
        keepAll: true,
        reportDir: 'playwright-report',
        reportFiles: 'index.html',
        reportName: 'Playwright MX QST'
      ])
      publishHTML(target: [
        allowMissing: true,
        alwaysLinkToLastBuild: true,
        keepAll: true,
        reportDir: 'test-results/jenkins/mx-fast/playwright-report',
        reportFiles: 'index.html',
        reportName: 'Samsung MX Fast - Playwright'
      ])
      publishHTML(target: [
        allowMissing: true,
        alwaysLinkToLastBuild: true,
        keepAll: true,
        reportDir: 'test-results/jenkins/mx-fast/allure-report',
        reportFiles: 'index.html',
        reportName: 'Samsung MX Fast - Allure'
      ])
      publishHTML(target: [
        allowMissing: true,
        alwaysLinkToLastBuild: true,
        keepAll: true,
        reportDir: 'test-results/jenkins/mx-qst/executive',
        reportFiles: 'index.html',
        reportName: 'MX QST Executive Dashboard'
      ])
      publishHTML(target: [
        allowMissing: true,
        alwaysLinkToLastBuild: true,
        keepAll: true,
        reportDir: 'test-results/jenkins/mx-qst/allure-report',
        reportFiles: 'index.html',
        reportName: 'Samsung MX QST - Allure'
      ])
      script {
        def nativeAllurePath = params.TEST_SUITE == 'fast-guest' ? 'test-results/jenkins/mx-fast/allure-results' : 'test-results/jenkins/mx-qst/allure-results'
        if (params.TEST_SUITE != 'allure-smoke' && fileExists(nativeAllurePath)) {
          allure includeProperties: false, results: [[path: nativeAllurePath]]
        }
      }
      publishHTML(target: [
        allowMissing: true,
        alwaysLinkToLastBuild: true,
        keepAll: true,
        reportDir: 'test-results/reporter-tests/allure-smoke/allure-report',
        reportFiles: 'index.html',
        reportName: 'Allure Reporting Smoke'
      ])
    }
    success { echo 'Samsung SMB automation build completed successfully.' }
    unsuccessful { echo 'Samsung SMB automation build did not complete successfully. Review console output and archived Playwright/Allure evidence.' }
  }
}
