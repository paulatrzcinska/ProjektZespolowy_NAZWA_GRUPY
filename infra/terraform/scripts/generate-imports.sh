#!/usr/bin/env bash
# Generuje imports.generated.tf: bloki `import` dla zasobów utworzonych ręcznie
# w konsoli (sieć z Bloku 3, RDS z Bloku 5). Zasoby są wyszukiwane po nazwach,
# więc w repozytorium nie ma żadnych identyfikatorów. Plik wynikowy jest w
# .gitignore - nie commitować go.
#
# Uruchomienie (AWS CloudShell lub AWS CLI z dostępem do konta, region eu-north-1):
#   cd infra/terraform && ./scripts/generate-imports.sh
#   terraform plan    # nie może być "destroy" ani "must be replaced"
#
# Skrypt tylko czyta konfigurację AWS; niczego nie tworzy ani nie zmienia.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="imports.generated.tf"
VPC_CIDR="10.0.0.0/16"
PREFIX="pz"
missing=0

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-eu-north-1}"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
echo "# Wygenerowane przez scripts/generate-imports.sh - NIE COMMITOWAĆ." > "$tmp"
echo >> "$tmp"

emit() { # $1 = adres w Terraform, $2 = identyfikator importu
  if [ -z "$2" ] || [ "$2" = "None" ]; then
    echo "UWAGA: nie znaleziono zasobu dla $1" >&2
    missing=1
    return
  fi
  printf 'import {\n  to = %s\n  id = "%s"\n}\n\n' "$1" "$2" >> "$tmp"
  echo "ok  $1"
}

q() { # zapytanie AWS CLI zwracające jeden tekst
  "$@" --output text 2>/dev/null || echo "None"
}

# --- VPC i Internet Gateway ---
vpc_count=$(q aws ec2 describe-vpcs --filters "Name=cidr,Values=$VPC_CIDR" --query 'length(Vpcs)')
if [ "$vpc_count" != "1" ]; then
  echo "BŁĄD: oczekiwano jednej VPC $VPC_CIDR, znaleziono: $vpc_count" >&2
  exit 1
fi
vpc=$(q aws ec2 describe-vpcs --filters "Name=cidr,Values=$VPC_CIDR" --query 'Vpcs[0].VpcId')
emit 'aws_vpc.main' "$vpc"
emit 'aws_internet_gateway.main' \
  "$(q aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$vpc" --query 'InternetGateways[0].InternetGatewayId')"

# --- Tablice tras ---
rt_id() {
  q aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$vpc" "Name=tag:Name,Values=$1" \
    --query 'RouteTables[0].RouteTableId'
}
rt_public=$(rt_id rt-public)
rt_private=$(rt_id rt-private)
emit 'aws_route_table.public' "$rt_public"
emit 'aws_route_table.private' "$rt_private"

# --- Podsieci i powiązania z tablicami tras (klucze jak w var.subnets) ---
for name in public-web private-app private-db private-db-2; do
  subnet=$(q aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc" "Name=tag:Name,Values=$name" \
    --query 'Subnets[0].SubnetId')
  emit "aws_subnet.this[\"$name\"]" "$subnet"

  [ "$name" = "public-web" ] && expected="$rt_public" || expected="$rt_private"
  current=$(q aws ec2 describe-route-tables --filters "Name=association.subnet-id,Values=$subnet" \
    --query 'RouteTables[0].RouteTableId')
  if [ "$current" = "$expected" ]; then
    emit "aws_route_table_association.this[\"$name\"]" "$subnet/$current"
  elif [ "$current" = "None" ]; then
    echo "info $name nie ma jawnego powiązania - Terraform je utworzy"
  else
    echo "UWAGA: $name jest powiązana z $current zamiast z tablicą z kodu ($expected)." >&2
    echo "       Usuń to powiązanie w konsoli (VPC -> Route tables) i uruchom skrypt ponownie," >&2
    echo "       wtedy Terraform utworzy właściwe powiązanie." >&2
    missing=1
  fi
done

# --- Security Groups ---
sg_id() {
  q aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc" "Name=group-name,Values=$1" \
    --query 'SecurityGroups[0].GroupId'
}
sg_web=$(sg_id web-sg)
sg_app=$(sg_id app-sg)
sg_db=$(sg_id db-sg)
emit 'aws_security_group.web' "$sg_web"
emit 'aws_security_group.app' "$sg_app"
emit 'aws_security_group.db' "$sg_db"

# --- Reguły Security Groups ---
rule_id() { # $1 grupa, $2 egress true/false, $3 protokół, $4 port|"", $5 cidr|"", $6 grupa źródłowa|""
  local query="SecurityGroupRules[?IsEgress==\`$2\` && IpProtocol=='$3'"
  [ -n "$4" ] && query+=" && FromPort==\`$4\` && ToPort==\`$4\`"
  [ -n "$5" ] && query+=" && CidrIpv4=='$5'"
  [ -n "$6" ] && query+=" && ReferencedGroupInfo.GroupId=='$6'"
  query+="].SecurityGroupRuleId | [0]"
  q aws ec2 describe-security-group-rules --filters "Name=group-id,Values=$1" --query "$query"
}
emit 'aws_vpc_security_group_ingress_rule.web_http'     "$(rule_id "$sg_web" false tcp 80 0.0.0.0/0 '')"
emit 'aws_vpc_security_group_ingress_rule.web_https'    "$(rule_id "$sg_web" false tcp 443 0.0.0.0/0 '')"
emit 'aws_vpc_security_group_ingress_rule.app_from_web' "$(rule_id "$sg_app" false tcp 8000 '' "$sg_web")"
emit 'aws_vpc_security_group_ingress_rule.db_from_app'  "$(rule_id "$sg_db" false tcp 5432 '' "$sg_app")"
emit 'aws_vpc_security_group_egress_rule.all_out["web"]' "$(rule_id "$sg_web" true -1 '' 0.0.0.0/0 '')"
emit 'aws_vpc_security_group_egress_rule.all_out["app"]' "$(rule_id "$sg_app" true -1 '' 0.0.0.0/0 '')"
emit 'aws_vpc_security_group_egress_rule.db_to_app'      "$(rule_id "$sg_db" true tcp 5432 '' "$sg_app")"

# --- RDS ---
emit 'aws_db_subnet_group.db' \
  "$(q aws rds describe-db-subnet-groups --db-subnet-group-name "$PREFIX-db-subnet-group" --query 'DBSubnetGroups[0].DBSubnetGroupName')"
emit 'aws_db_instance.main' \
  "$(q aws rds describe-db-instances --db-instance-identifier "$PREFIX-db" --query 'DBInstances[0].DBInstanceIdentifier')"

mv "$tmp" "$OUT"
trap - EXIT
echo
echo "Zapisano $OUT ($(grep -c '^import' "$OUT") bloków import)."
if [ "$missing" -ne 0 ]; then
  echo "Są ostrzeżenia powyżej - przejrzyj je przed terraform plan." >&2
  exit 2
fi
