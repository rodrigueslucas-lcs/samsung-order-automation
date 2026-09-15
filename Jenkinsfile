pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '15'))
    timeout(time: 45, unit: 'MINUTES')
    skipDefaultCheckout(true)
  }

  parameters {
    booleanParam(name: 'RUN_MX_QST', defaultValue: true, description: 'Run official MX S1 Base Store P1/QST suite')
    booleanParam(name: 'RUN_DESTRUCTIVE', defaultValue: false, description: 'Allow payment/order scenarios. Enable only on an authorized S1 agent.')
    booleanParam(name: 'ENABLE_VIDEO', defaultValue: false, description: 'Enable Playwright video only after FFmpeg is proven on this Jenkins agent.')
  }

  environment {
    CI = '1'
    MX_QST_ARTIFACT_DIR = 'test-results/jenkins/mx-qst'
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
          if (isUnix()) {
            sh 'npm ci'
          } else {
            bat '@npm ci'
          }
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

          // Authentication and MX test-card material remain outside Git.
          // Once Jenkins credential IDs are approved, this stage will materialize
          // secret files into the gitignored playwright/.auth directory for the
          // duration of the workspace only. Until then, fail closed if prerequisites
          // are absent rather than weakening/skipping official TCs.
          if (isUnix()) {
            sh '''
              test -f playwright/.auth/mx-s1-user.json || { echo "Missing MX auth state in playwright/.auth"; exit 2; }
              test -f playwright/.auth/mx-test-card.json || { echo "Missing MX test-card secret file in playwright/.auth"; exit 2; }
              npm run qst:mx:base-store
            '''
          } else {
            bat '''@echo off
              if not exist playwright\\.auth\\mx-s1-user.json (
                echo Missing MX auth state in playwright/.auth
                exit /b 2
              )
              if not exist playwright\\.auth\\mx-test-card.json (
                echo Missing MX test-card secret file in playwright/.auth
                exit /b 2
              )
              call npm run qst:mx:base-store
            '''
          }
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'test-results/**/*, playwright-report/**/*', allowEmptyArchive: true, fingerprint: true
    }
    success {
      echo 'Samsung SMB automation build completed successfully.'
    }
    unsuccessful {
      echo 'Samsung SMB automation build did not complete successfully. Review console output and archived Playwright evidence.'
    }
  }
}
