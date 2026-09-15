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
    booleanParam(name: 'RUN_MX_QST', defaultValue: true, description: 'Run official MX S1 Base Store P1/QST suite')
    booleanParam(name: 'RUN_DESTRUCTIVE', defaultValue: false, description: 'Allow payment/order scenarios. Enable only on an authorized S1 agent.')
    booleanParam(name: 'ENABLE_VIDEO', defaultValue: false, description: 'Enable Playwright video only after FFmpeg is proven on this Jenkins agent.')
    booleanParam(name: 'HEADLESS', defaultValue: true, description: 'Run Playwright headless. Recommended for Jenkins service agents.')
  }

  environment {
    CI = '1'
    MX_QST_ARTIFACT_DIR = 'test-results/jenkins/mx-qst'
    MX_QST_USE_EXISTING_AUTH = '1'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
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
          if (isUnix()) sh 'npm ci'
          else bat '@npm ci'
        }
      }
    }

    stage('Official SMB Gate') {
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

    stage('MX QST') {
      when {
        expression { return params.RUN_MX_QST }
      }
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
                npm run qst:mx:base-store
              '''
            } else {
              bat '''@echo off
                if not exist playwright\\.auth mkdir playwright\\.auth
                copy /Y "%MX_AUTH_STATE_SECRET%" "playwright\\.auth\\mx-s1-user.json" >nul || exit /b 2
                copy /Y "%MX_SESSION_STORAGE_SECRET%" "playwright\\.auth\\mx-s1-session-storage.json" >nul || exit /b 2
                copy /Y "%MX_TEST_CARD_SECRET%" "playwright\\.auth\\mx-test-card.json" >nul || exit /b 2
                call npm run qst:mx:base-store
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
        reportDir: 'test-results/jenkins/mx-qst/executive',
        reportFiles: 'index.html',
        reportName: 'MX QST Executive Dashboard'
      ])
    }
    success {
      echo 'Samsung SMB automation build completed successfully.'
    }
    unsuccessful {
      echo 'Samsung SMB automation build did not complete successfully. Review console output and archived Playwright evidence.'
    }
  }
}
