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
  }

  environment {
    CI = '1'
    MX_QST_ARTIFACT_DIR = 'test-results/jenkins/mx-qst'
    PW_VIDEO = '0'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      steps {
        sh 'node --version && npm --version'
        sh 'npm ci'
      }
    }

    stage('Official SMB Gate') {
      steps {
        sh 'npm run qst:official:gate'
        sh 'npm run qst:mx:list'
      }
    }

    stage('MX QST') {
      when {
        expression { return params.RUN_MX_QST }
      }
      steps {
        script {
          if (!params.RUN_DESTRUCTIVE) {
            error('Official MX QST currently contains authorized payment/order P1 scenarios. RUN_DESTRUCTIVE must be enabled for the full 30-TC campaign.')
          }
        }
        // Authentication and test-card material are intentionally not stored in Git.
        // The Jenkins controller/agent must inject them from Jenkins Credentials before
        // this stage can be enabled unattended. Until that wiring is complete, this
        // stage is deliberately gated rather than weakening the suite or skipping TCs.
        sh 'npm run qst:mx:base-store'
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'test-results/**/*, playwright-report/**/*', allowEmptyArchive: true, fingerprint: true
    }
  }
}
