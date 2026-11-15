pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "dentarvd/frontend"
    }

    stages {
        stage('Preparation') {
            steps {
                echo 'Preparation du pipeline Frontend DentaRDV'
                sh 'docker --version'
                sh 'trivy --version'
                sh 'git --version'
            }
        }

        stage('Tests et audit npm') {
            steps {
                sh '''
                    docker run --rm \
                      -v "$WORKSPACE:/app" \
                      -w /app \
                      node:22-alpine \
                      sh -c "npm ci && npm test && npm audit --audit-level=high"
                '''
            }
        }

        stage('Build Docker') {
            steps {
                sh '''
                    docker build \
                      -t ${DOCKER_IMAGE}:${BUILD_NUMBER} \
                      -t ${DOCKER_IMAGE}:latest .
                '''
            }
        }

        stage('Analyse Trivy') {
            steps {
                sh '''
                    echo "Rapport des vulnerabilites HIGH et CRITICAL"
                    trivy image --severity HIGH,CRITICAL \
                      ${DOCKER_IMAGE}:${BUILD_NUMBER} || true

                    echo "Verification bloquante des vulnerabilites CRITICAL"
                    trivy image --severity CRITICAL \
                      --exit-code 1 \
                      ${DOCKER_IMAGE}:${BUILD_NUMBER}
                '''
            }
        }

        stage('Publication Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKERHUB_USER',
                    passwordVariable: 'DOCKERHUB_TOKEN'
                )]) {
                    sh '''
                        echo "$DOCKERHUB_TOKEN" | docker login \
                          -u "$DOCKERHUB_USER" --password-stdin

                        docker push ${DOCKER_IMAGE}:${BUILD_NUMBER}
                        docker push ${DOCKER_IMAGE}:latest

                        docker logout
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'SUCCESS : frontend valide et publie sur Docker Hub'
        }
        failure {
            echo 'ECHEC : verifier les logs du pipeline Frontend'
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
